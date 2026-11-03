-- В том числе запрещаем комментарии из одних переводов строки и табуляций.
-- Нарушение ограничения откатывает всю транзакцию смены статуса.
alter table public.task_history add constraint task_history_revision_comment_check
  check (to_status <> 'revision' or (comment is not null and comment ~ '[^[:space:]]'));
