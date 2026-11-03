begin;
-- Одноразовые пользователи; вся проверка откатывается вместе с данными.
insert into auth.users (id, email) values
 ('10000000-0000-4000-8000-000000000001', 'test-manager-1@example.test'),
 ('10000000-0000-4000-8000-000000000002', 'test-executor-1@example.test'),
 ('10000000-0000-4000-8000-000000000003', 'test-executor-2@example.test'),
 ('10000000-0000-4000-8000-000000000004', 'test-manager-2@example.test'),
 ('10000000-0000-4000-8000-000000000005', 'test-no-profile@example.test');
insert into public.profiles (id, display_name, role) values
 ('10000000-0000-4000-8000-000000000001', 'Постановщик 1', 'manager'),
 ('10000000-0000-4000-8000-000000000002', 'Исполнитель 1', 'executor'),
 ('10000000-0000-4000-8000-000000000003', 'Исполнитель 2', 'executor'),
 ('10000000-0000-4000-8000-000000000004', 'Постановщик 2', 'manager');

create function pg_temp.must_fail(statement text, expected text) returns void
language plpgsql as $$
begin
  execute statement;
  raise exception 'TEST_EXPECTED_FAILURE: %', statement;
exception when others then
  if sqlerrm like 'TEST_EXPECTED_FAILURE:%' or position(expected in sqlerrm) = 0 then raise; end if;
end;
$$;

do $$
declare
  m uuid := '10000000-0000-4000-8000-000000000001';
  e1 uuid := '10000000-0000-4000-8000-000000000002';
  e2 uuid := '10000000-0000-4000-8000-000000000003';
  m2 uuid := '10000000-0000-4000-8000-000000000004';
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); req uuid := gen_random_uuid();
  v_task public.tasks; v_project public.projects; v_count integer; v_other integer;
  from_s public.task_status; to_s public.task_status; actor uuid; matrix_task uuid;
  allowed boolean; succeeded boolean; test_count integer := 0;
begin
  perform set_config('request.jwt.claim.sub', m::text, true);
  execute 'set local role authenticated';
  select * into v_project from public.save_project(p1, 'Тестовый объект 1', 'Адрес 1');
  perform public.save_project(p2, 'Тестовый объект 2', 'Адрес 2');
  -- Повтор создания не порождает дубль.
  perform public.save_project(p1, 'Тестовый объект 1', 'Адрес 1');
  select count(*) into v_count from public.projects where id in (p1,p2);
  assert v_count = 2, 'Повтор создания объекта';
  perform public.save_task(t1, 'Задача 1', 'Описание', p1, e1);
  perform public.save_task(t1, 'Задача 1', 'Описание', p1, e1);
  perform public.save_task(t2, 'Задача 2', '', p2, e2);
  select count(*) into v_count from public.task_history where task_id = t1;
  assert v_count = 1, 'Дублирование истории при повторе создания';
  perform pg_temp.must_fail(format('select public.save_task(%L, %L, %L, %L, %L)',gen_random_uuid(),'Ошибка','',p1,m), 'INVALID_ASSIGNEE');
  perform pg_temp.must_fail(format('update public.tasks set status = %L where id = %L','accepted',t1), 'permission denied');
  perform pg_temp.must_fail(format('insert into public.task_history(task_id,actor_id,to_status) values(%L,%L,%L)',t1,m,'accepted'), 'permission denied');
  perform pg_temp.must_fail('update public.task_history set comment = ''Подмена''', 'permission denied');
  perform pg_temp.must_fail('delete from public.task_history', 'permission denied');
  perform pg_temp.must_fail('update public.profiles set role = ''manager''', 'permission denied');
  perform pg_temp.must_fail(format('select public.delete_task(%L, null)',t1), 'VERSION_CONFLICT');
  perform pg_temp.must_fail(format('select public.delete_project(%L, null)',p1), 'VERSION_CONFLICT');

  perform set_config('request.jwt.claim.sub', e1::text, true);
  select count(*) into v_count from public.tasks where id in (t1,t2);
  assert v_count = 1, 'RLS задач';
  select count(*) into v_count from public.projects where id in (p1,p2);
  assert v_count = 1, 'RLS объектов';
  select count(*) into v_count from public.task_history where task_id = t2;
  assert v_count = 0, 'Чтение чужой истории';
  select count(*) into v_count from public.profiles where id = e2;
  assert v_count = 0, 'Чтение чужого профиля';
  perform pg_temp.must_fail(format('select public.change_task_status(%L,%L,1,%L)',t2,'in_progress',req), 'NOT_FOUND');
  perform pg_temp.must_fail(format('select public.save_project(%L,%L,%L)',gen_random_uuid(),'Запрещено','Адрес'), 'FORBIDDEN');
  perform pg_temp.must_fail(format('select public.delete_task(%L,1)',t1), 'FORBIDDEN');
  perform pg_temp.must_fail(format('select public.delete_project(%L,1)',p1), 'FORBIDDEN');
  select * into v_task from public.change_task_status(t1, 'in_progress', 1, req);
  assert v_task.version = 2 and v_task.status = 'in_progress', 'Переход исполнителя';
  select * into v_task from public.change_task_status(t1, 'in_progress', 1, req);
  assert v_task.version = 2, 'Идемпотентность перехода';
  select count(*) into v_count from public.task_history where task_id = t1;
  assert v_count = 2, 'Переход записан дважды';
  select count(*) into v_count from public.task_history where task_id=t1 and from_status='new' and to_status='in_progress' and actor_id=e1;
  assert v_count = 1, 'Неверный автор или исходный статус истории';
  perform pg_temp.must_fail(format('select public.change_task_status(%L,%L,2,%L)',t1,'in_review',req), 'IDEMPOTENCY_CONFLICT');
  perform pg_temp.must_fail(format('select public.change_task_status(%L,%L,1,%L)',t1,'in_review',gen_random_uuid()), 'VERSION_CONFLICT');
  perform public.change_task_status(t1, 'in_review', 2, gen_random_uuid());
  perform set_config('request.jwt.claim.sub', m2::text, true);
  perform pg_temp.must_fail(format('select public.change_task_status(%L,%L,3,%L,%L)',t1,'revision',gen_random_uuid(),'   '), 'COMMENT_REQUIRED');
  perform public.change_task_status(t1, 'revision', 3, gen_random_uuid(), 'Исправить примыкание');
  perform set_config('request.jwt.claim.sub', e1::text, true);
  select count(*) into v_count from public.profiles where id=m2;
  assert v_count=1, 'Не виден автор комментария другого постановщика';
  perform public.change_task_status(t1, 'in_progress', 4, gen_random_uuid());
  perform public.change_task_status(t1, 'in_review', 5, gen_random_uuid());
  perform set_config('request.jwt.claim.sub', m::text, true);
  perform public.change_task_status(t1, 'accepted', 6, gen_random_uuid());
  perform pg_temp.must_fail(format('select public.save_task(%L,%L,%L,%L,%L,1)',t1,'Старый заголовок','',p1,e1), 'VERSION_CONFLICT');

  -- Полная матрица: два постановщика, назначенный и посторонний исполнитель,
  -- каждый исходный и целевой статус. Пропущенные переходы тоже проверяются.
  foreach actor in array array[m,m2,e1,e2] loop
    foreach from_s in array enum_range(null::public.task_status) loop
      foreach to_s in array enum_range(null::public.task_status) loop
        execute 'reset role';
        matrix_task := gen_random_uuid();
        insert into public.tasks(id,title,project_id,assignee_id,author_id,status)
          values(matrix_task,'Матрица',p1,e1,m,from_s);
        perform set_config('request.jwt.claim.sub',actor::text,true);
        execute 'set local role authenticated';
        allowed := (actor=e1 and ((from_s in ('new','revision') and to_s='in_progress') or (from_s='in_progress' and to_s='in_review')))
          or (actor in (m,m2) and from_s='in_review' and to_s in ('accepted','revision'));
        succeeded := false;
        begin
          perform public.change_task_status(matrix_task,to_s,1,gen_random_uuid(),'Комментарий');
          succeeded := true;
        exception when others then
          if sqlerrm not in ('INVALID_TRANSITION','NOT_FOUND') then raise; end if;
        end;
        assert succeeded=allowed, format('Матрица: %s, %s -> %s', actor,from_s,to_s);
        test_count := test_count + 1;
      end loop;
    end loop;
  end loop;
  assert test_count=100, 'Неполная матрица';

  perform set_config('request.jwt.claim.sub',m2::text,true);
  select count(*) into v_count from public.tasks where id in(t1,t2);
  assert v_count=2, 'Второй постановщик должен видеть всё';
  -- Переназначение немедленно закрывает доступ старому исполнителю.
  perform public.save_task(t2,'Задача 2','',p2,e1,1);
  perform set_config('request.jwt.claim.sub',e2::text,true);
  select count(*) into v_count from public.tasks where id=t2;
  select count(*) into v_other from public.projects where id=p2;
  assert v_count=0 and v_other=0, 'Доступ после переназначения';
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
  select count(*) into v_count from public.tasks;
  assert v_count=0, 'Пользователь без профиля видит задачи';
  perform pg_temp.must_fail(format('select public.change_task_status(%L,%L,1,%L)',t1,'in_progress',gen_random_uuid()), 'FORBIDDEN');
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform public.delete_task(t2,2);
  perform public.delete_task(t2,2);
  perform public.delete_project(p1,1);
  perform public.delete_project(p1,1);
  select count(*) into v_count from public.task_history where task_id=t1;
  assert v_count=0, 'Каскадное удаление истории';
  execute 'set local role anon';
  perform pg_temp.must_fail('select * from public.tasks', 'permission denied');
  perform pg_temp.must_fail(format('select public.save_project(%L,%L,%L)',gen_random_uuid(),'Закрыто','Адрес'), 'permission denied');
  execute 'reset role';
  raise notice 'OK: 100 переходов и проверки RLS, истории, повторов, конфликтов, нескольких ролей';
end;
$$;
rollback;
