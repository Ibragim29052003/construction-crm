-- Индексы внешних ключей: проверки связей и чтение участников истории.
create index projects_created_by_idx on public.projects(created_by);
create index tasks_author_idx on public.tasks(author_id);
create index task_history_actor_task_idx on public.task_history(actor_id, task_id);
