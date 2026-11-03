import type { TaskStatus } from '../../shared/api/types'
import { STATUS } from './status'
export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true" />
      {STATUS[status].label}
    </span>
  )
}
