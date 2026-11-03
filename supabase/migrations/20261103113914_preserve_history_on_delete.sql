-- Удаление скрывает данные, но не уничтожает историю через API.
alter table public.projects add column deleted_at timestamptz;
alter table public.tasks add column deleted_at timestamptz;

alter policy projects_read on public.projects using (
  deleted_at is null and ((select private.is_manager()) or exists (
    select 1 from public.tasks where project_id = projects.id and assignee_id = (select auth.uid())
  ))
);
alter policy tasks_read on public.tasks using (
  deleted_at is null and ((select private.is_manager()) or assignee_id = (select auth.uid()))
);

create or replace function private.can_read_profile(profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select profile_id = (select auth.uid()) or private.is_manager() or exists (
    select 1 from public.tasks where deleted_at is null and assignee_id = (select auth.uid())
      and (assignee_id = profile_id or author_id = profile_id)
  ) or exists (
    select 1 from public.task_history h join public.tasks t on t.id = h.task_id
    where t.deleted_at is null and t.assignee_id = (select auth.uid()) and h.actor_id = profile_id
  );
$$;

create or replace function public.save_project(
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
    if v_project.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if v_project.created_by <> auth.uid() or v_project.name <> btrim(p_name)
      or v_project.address <> btrim(p_address) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_project;
  end if;
  select * into v_project from public.projects where id = p_id for update;
  if not found or v_project.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_project.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.projects set name = btrim(p_name), address = btrim(p_address), version = version + 1
    where id = p_id returning * into v_project;
  return v_project;
end;
$$;

create or replace function public.delete_project(p_id uuid, p_expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select version into v_version from public.projects where id = p_id and deleted_at is null for update;
  if not found then return; end if; -- Повтор удаления ничего не меняет.
  if p_expected_version is null or v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.projects set deleted_at = now(), version = version + 1 where id = p_id;
  update public.tasks set deleted_at = now(), updated_at = now(), version = version + 1
    where project_id = p_id and deleted_at is null;
end;
$$;

create or replace function public.save_task(
  p_id uuid, p_title text, p_description text, p_project_id uuid, p_assignee_id uuid,
  p_expected_version integer default null
) returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks; v_inserted boolean;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  -- Блокировка объекта сериализует создание/перенос задачи с его удалением.
  perform 1 from public.projects where id = p_project_id and deleted_at is null for share;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.profiles where id = p_assignee_id and role = 'executor')
    then raise exception 'INVALID_ASSIGNEE'; end if;
  if p_expected_version is null then
    insert into public.tasks (id, title, description, project_id, assignee_id, author_id)
      values (p_id, btrim(p_title), btrim(p_description), p_project_id, p_assignee_id, auth.uid())
      on conflict (id) do nothing;
    v_inserted := found;
    select * into v_task from public.tasks where id = p_id;
    if v_task.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
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
  if not found or v_task.deleted_at is not null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_task.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.tasks set title = btrim(p_title), description = btrim(p_description),
    project_id = p_project_id, assignee_id = p_assignee_id, updated_at = now(), version = version + 1
    where id = p_id returning * into v_task;
  return v_task;
end;
$$;

create or replace function public.delete_task(p_id uuid, p_expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select version into v_version from public.tasks where id = p_id and deleted_at is null for update;
  if not found then return; end if;
  if p_expected_version is null or v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.tasks set deleted_at = now(), updated_at = now(), version = version + 1 where id = p_id;
end;
$$;

create or replace function public.change_task_status(
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
  if not found or v_task.deleted_at is not null or (v_role <> 'manager' and v_task.assignee_id <> auth.uid())
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

