import { StatusBadge } from './StatusBadge'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Pencil, Trash2 } from 'lucide-react'
import { useDeleteTaskMutation, useGetTaskQuery } from '../../shared/api/crm-api'
import type { TaskStatus } from '../../shared/api/types'
import { EmptyState, ErrorState, Loading } from '../../shared/ui/primitives'
import { formatDate, initials } from '../../shared/ui/format'
import { DeleteDialog } from '../../shared/ui/DeleteDialog'
import { useProfile } from '../auth/auth-context'
import { TaskForm } from './TaskForm'
import { TransitionForm } from './TransitionForm'
import { STATUS, availableTransitions } from './status'
export function TaskPage() {
  const { taskId = '' } = useParams()
  const query = useGetTaskQuery(taskId)
  const profile = useProfile()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const [target, setTarget] = useState<TaskStatus | null>(null)
  const [remove, removal] = useDeleteTaskMutation()
  const task = query.data
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={query.refetch} />
  if (!task)
    return (
      <EmptyState title="Задача недоступна">
        Вернитесь к списку объектов и выберите другую задачу.
      </EmptyState>
    )
  const actions = availableTransitions(profile.role, task.status, task.assignee_id === profile.id)
  const history = [...task.history].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
  )
  async function deleteTask() {
    try {
      await remove({ id: task!.id, version: task!.version }).unwrap()
      navigate(`/projects/${task!.project_id}`, { replace: true })
    } catch {
      /* Показано в диалоге. */
    }
  }
  return (
    <>
      <Link className="back-link" to={`/projects/${task.project_id}`}>
        <ArrowLeft size={16} />
        {task.project.name}
      </Link>
      <div className="page-heading task-heading">
        <div>
          <span className="eyebrow">КАРТОЧКА ЗАДАЧИ</span>
          <h1>{task.title}</h1>
          <div className="task-heading-meta">
            <StatusBadge status={task.status} />
            <span>
              <CalendarDays size={15} />
              Создана {formatDate(task.created_at)}
            </span>
          </div>
        </div>
        {profile.role === 'manager' && (
          <div className="action-group">
            <button className="button secondary" onClick={() => setDialog('edit')}>
              <Pencil size={16} />
              Изменить
            </button>
            <button
              className="icon-button bordered danger-text"
              aria-label="Удалить задачу"
              title="Удалить задачу"
              onClick={() => setDialog('delete')}
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>
      <div className="task-detail-grid">
        <div>
          <section className="detail-panel">
            <h2>О задаче</h2>
            <p className="task-description">{task.description || 'Описание не добавлено.'}</p>
            <dl className="task-facts">
              <div>
                <dt>Объект</dt>
                <dd>
                  <Link to={`/projects/${task.project_id}`}>
                    {task.project.name}
                    <ArrowRight size={14} />
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Исполнитель</dt>
                <dd>
                  <span className="avatar small">{initials(task.assignee.display_name)}</span>
                  {task.assignee.display_name}
                </dd>
              </div>
              <div>
                <dt>Постановщик</dt>
                <dd>{task.author.display_name}</dd>
              </div>
            </dl>
          </section>
          <section className="detail-panel action-panel" aria-label="Доступные действия">
            <h2>{actions.length ? 'Следующий шаг' : 'Текущий этап'}</h2>
            {actions.length ? (
              <>
                <p className="muted">
                  {profile.role === 'manager'
                    ? 'Проверьте результат и примите решение по задаче.'
                    : 'Измените статус, когда будете готовы к следующему этапу.'}
                </p>
                <div className="action-group">
                  {actions.map((status) => (
                    <button
                      key={status}
                      className={`button ${status === 'revision' ? 'secondary' : 'primary'}`}
                      onClick={() => setTarget(status)}
                    >
                      {status === 'accepted' ? <Check size={17} /> : <ArrowRight size={17} />}
                      {STATUS[status].action}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">
                {task.status === 'accepted'
                  ? 'Работа принята. Задача завершена.'
                  : task.status === 'in_review'
                    ? 'Результат отправлен на проверку. Ожидайте решения постановщика.'
                    : 'Следующее действие доступно назначенному исполнителю.'}
              </p>
            )}
          </section>
        </div>
        <section className="detail-panel history-panel">
          <h2>
            <Clock3 size={19} />
            История задачи <span className="counter">{history.length}</span>
          </h2>
          <ol className="timeline">
            {history.map((event) => (
              <li key={event.id}>
                <span className={`timeline-dot ${event.to_status === 'accepted' ? 'done' : ''}`} />
                <div className="history-status">
                  {event.from_status && (
                    <>
                      <span>{STATUS[event.from_status].label}</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                  <strong>{STATUS[event.to_status].label}</strong>
                </div>
                <p className="history-person">{event.actor.display_name}</p>
                <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                {event.comment && <p className="history-comment">{event.comment}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {dialog === 'edit' && <TaskForm task={task} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <DeleteDialog
          title="Удалить задачу?"
          busy={removal.isLoading}
          error={removal.error}
          onClose={() => setDialog(null)}
          onDelete={() => void deleteTask()}
        >
          Задача «{task.title}» исчезнет из списков. История изменений сохранится.
        </DeleteDialog>
      )}
      {target && <TransitionForm task={task} target={target} onClose={() => setTarget(null)} />}
    </>
  )
}
