const messages: Record<string, string> = {
  VERSION_CONFLICT: 'Задача или объект уже изменились. Обновите страницу и повторите действие.',
  FORBIDDEN: 'У вас нет доступа к этому действию.',
  NOT_FOUND: 'Запись не найдена или у вас нет доступа к ней.',
  INVALID_TRANSITION: 'Этот переход статуса недоступен. Обновите данные задачи.',
  COMMENT_REQUIRED: 'Напишите, что нужно доработать.',
  COMMENT_TOO_LONG: 'Комментарий должен быть не длиннее 2000 символов.',
  INVALID_ASSIGNEE: 'Выберите пользователя с ролью исполнителя.',
  IDEMPOTENCY_CONFLICT: 'Повторный запрос содержит другие данные. Откройте форму заново.',
}
export interface ApiError {
  message: string
  code?: string
}
export function toApiError(error: unknown): ApiError {
  const raw = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
  if (messages[raw]) return { message: messages[raw], code: raw }
  if (code === '23503') return { message: 'Связанная запись была удалена. Обновите данные.', code }
  if (raw.includes('Invalid login credentials')) return { message: 'Неверный email или пароль.' }
  if (raw.includes('Email not confirmed'))
    return { message: 'Учётная запись ещё не подтверждена. Обратитесь к администратору.' }
  if (code === '42501') return { message: 'У вас нет доступа к этому действию.', code }
  if (/rate limit|too many requests/i.test(raw))
    return { message: 'Слишком много попыток. Попробуйте немного позже.' }
  return { message: 'Не удалось выполнить запрос. Проверьте соединение и повторите попытку.', code }
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Не удалось загрузить данные.'
}
