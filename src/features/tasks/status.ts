import type { Role, TaskStatus } from '../../shared/api/types'
export const STATUS: Record<TaskStatus, { label: string; action: string }> = {
  new: { label: 'Новая', action: '' },
  in_progress: { label: 'В работе', action: 'Взять в работу' },
  in_review: { label: 'На проверке', action: 'Отправить на проверку' },
  accepted: { label: 'Принята', action: 'Принять задачу' },
  revision: { label: 'На доработке', action: 'Вернуть на доработку' },
}
export function availableTransitions(
  role: Role,
  status: TaskStatus,
  isAssignee: boolean,
): TaskStatus[] {
  if (role === 'manager') return status === 'in_review' ? ['accepted', 'revision'] : []
  if (!isAssignee) return []
  if (status === 'new' || status === 'revision') return ['in_progress']
  if (status === 'in_progress') return ['in_review']
  return []
}
