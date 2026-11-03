-- Изменения данных доступны только через функции с явной проверкой роли.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'in_review', 'accepted', 'revision');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  role public.user_role not null
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  address text not null check (length(btrim(address)) between 1 and 300),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id),
  author_id uuid not null default auth.uid() references public.profiles(id),
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  request_id uuid,
  unique (task_id, request_id)
);
create index tasks_assignee_project_idx on public.tasks (assignee_id, project_id);
create index tasks_project_created_idx on public.tasks (project_id, created_at desc);
create index task_history_task_created_idx on public.task_history (task_id, created_at, id);

create function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'manager');
$$;
revoke all on function private.is_manager() from public;
grant execute on function private.is_manager() to authenticated;

-- Без рекурсии RLS: участник видит себя и людей из доступных ему задач.
create function private.can_read_profile(profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select profile_id = (select auth.uid()) or private.is_manager() or exists (
    select 1 from public.tasks where assignee_id = (select auth.uid())
      and (assignee_id = profile_id or author_id = profile_id)
  ) or exists (
    select 1 from public.task_history h join public.tasks t on t.id = h.task_id
    where t.assignee_id = (select auth.uid()) and h.actor_id = profile_id
  );
$$;
revoke all on function private.can_read_profile(uuid) from public;
grant execute on function private.can_read_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (private.can_read_profile(id));
create policy projects_read on public.projects for select to authenticated
  using ((select private.is_manager()) or exists (
    select 1 from public.tasks where project_id = projects.id and assignee_id = (select auth.uid())
  ));
create policy tasks_read on public.tasks for select to authenticated
  using ((select private.is_manager()) or assignee_id = (select auth.uid()));
create policy history_read on public.task_history for select to authenticated
  using (exists (select 1 from public.tasks where id = task_history.task_id));

revoke all on public.profiles, public.projects, public.tasks, public.task_history from anon, authenticated;
grant select on public.profiles, public.projects, public.tasks, public.task_history to authenticated;
revoke all on sequence public.task_history_id_seq from anon, authenticated;

create function public.save_project(
  p_id uuid, p_name text, p_address text, p_expected_version integer default null
) returns public.projects language plpgsql security definer set search_path = '' as $$
declare v_project public.projects;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_expected_version is null then
    -- UUID из формы делает повтор создания безопасным после обрыва связи.
    insert into public.projects (id, name, address, created_by)
      values (p_id, btrim(p_name), btrim(p_address), auth.uid())
      on conflict (id) do nothing;
    select * into v_project from public.projects where id = p_id;
    if v_project.created_by <> auth.uid() or v_project.name <> btrim(p_name)
      or v_project.address <> btrim(p_address) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_project;
  end if;
  select * into v_project from public.projects where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_project.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.projects set name = btrim(p_name), address = btrim(p_address), version = version + 1
    where id = p_id returning * into v_project;
  return v_project;
end;
$$;

create function public.delete_project(p_id uuid, p_expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select version into v_version from public.projects where id = p_id for update;
  if not found then return; end if; -- Повтор удаления ничего не меняет.
  if p_expected_version is null or v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  delete from public.projects where id = p_id;
end;
$$;

create function public.save_task(
  p_id uuid, p_title text, p_description text, p_project_id uuid, p_assignee_id uuid,
  p_expected_version integer default null
) returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_inserted boolean;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_assignee_id and role = 'executor')
    then raise exception 'INVALID_ASSIGNEE'; end if;
  if p_expected_version is null then
    insert into public.tasks (id, title, description, project_id, assignee_id, author_id)
      values (p_id, btrim(p_title), btrim(p_description), p_project_id, p_assignee_id, auth.uid())
      on conflict (id) do nothing;
    v_inserted := found;
    select * into v_task from public.tasks where id = p_id;
    if v_task.author_id <> auth.uid() or v_task.title <> btrim(p_title)
      or v_task.description <> btrim(p_description) or v_task.project_id <> p_project_id
      or v_task.assignee_id <> p_assignee_id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if v_inserted then
      insert into public.task_history (task_id, actor_id, from_status, to_status)
        values (p_id, auth.uid(), null, 'new');
    end if;
    return v_task;
  end if;
  select * into v_task from public.tasks where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_task.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.tasks set title = btrim(p_title), description = btrim(p_description),
    project_id = p_project_id, assignee_id = p_assignee_id, updated_at = now(), version = version + 1
    where id = p_id returning * into v_task;
  return v_task;
end;
$$;

create function public.delete_task(p_id uuid, p_expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select version into v_version from public.tasks where id = p_id for update;
  if not found then return; end if;
  if p_expected_version is null or v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  delete from public.tasks where id = p_id;
end;
$$;

create function public.change_task_status(
  p_task_id uuid, p_status public.task_status, p_expected_version integer,
  p_request_id uuid, p_comment text default null
) returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_event public.task_history; v_role public.user_role;
  v_comment text := nullif(btrim(p_comment), ''); v_from public.task_status;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  -- Чужую и несуществующую задачу не различаем.
  if not found or (v_role <> 'manager' and v_task.assignee_id <> auth.uid())
    then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select * into v_event from public.task_history where task_id = p_task_id and request_id = p_request_id;
  if found then
    if v_event.actor_id <> auth.uid() or v_event.to_status <> p_status
      or v_event.comment is distinct from v_comment then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_task;
  end if;
  if p_expected_version is null or v_task.version <> p_expected_version
    then raise exception 'VERSION_CONFLICT'; end if;
  if not (
    (v_role = 'executor' and v_task.assignee_id = auth.uid() and (
      (v_task.status in ('new', 'revision') and p_status = 'in_progress') or
      (v_task.status = 'in_progress' and p_status = 'in_review')
    )) or
    (v_role = 'manager' and v_task.status = 'in_review' and p_status in ('accepted', 'revision'))
  ) then raise exception 'INVALID_TRANSITION'; end if;
  if p_status = 'revision' and v_comment is null then raise exception 'COMMENT_REQUIRED'; end if;
  if length(v_comment) > 2000 then raise exception 'COMMENT_TOO_LONG'; end if;
  v_from := v_task.status;
  update public.tasks set status = p_status, updated_at = now(), version = version + 1
    where id = p_task_id returning * into v_task;
  insert into public.task_history (task_id, actor_id, from_status, to_status, comment, request_id)
    values (p_task_id, auth.uid(), v_from, p_status, v_comment, p_request_id);
  return v_task;
end;
$$;

-- PostgreSQL по умолчанию даёт PUBLIC право вызывать новые функции: закрываем явно.
revoke all on function public.save_project(uuid, text, text, integer) from public, anon;
revoke all on function public.delete_project(uuid, integer) from public, anon;
revoke all on function public.save_task(uuid, text, text, uuid, uuid, integer) from public, anon;
revoke all on function public.delete_task(uuid, integer) from public, anon;
revoke all on function public.change_task_status(uuid, public.task_status, integer, uuid, text) from public, anon;
grant execute on function public.save_project(uuid, text, text, integer) to authenticated;
grant execute on function public.delete_project(uuid, integer) to authenticated;
grant execute on function public.save_task(uuid, text, text, uuid, uuid, integer) to authenticated;
grant execute on function public.delete_task(uuid, integer) to authenticated;
grant execute on function public.change_task_status(uuid, public.task_status, integer, uuid, text) to authenticated;
