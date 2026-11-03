import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { skipToken } from '@reduxjs/toolkit/query'
import {
  useDeleteProjectMutation,
  useGetProjectsQuery,
  useGetTasksQuery,
} from '../../shared/api/crm-api'
import { EmptyState, ErrorState, Loading } from '../../shared/ui/primitives'
import { DeleteDialog } from '../../shared/ui/DeleteDialog'
import { useProfile } from '../auth/auth-context'
import { TaskList } from '../tasks/TaskList'
import { TaskForm } from '../tasks/TaskForm'
import { ProjectForm } from './ProjectForm'
export function ProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const manager = useProfile().role === 'manager'
  const projects = useGetProjectsQuery()
  const project = projects.data?.find((item) => item.id === projectId)
  const tasks = useGetTasksQuery(project ? { projectId } : skipToken)
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'task' | null>(null)
  const [remove, removal] = useDeleteProjectMutation()
  if (projects.isLoading) return <Loading />
  if (projects.error) return <ErrorState error={projects.error} retry={projects.refetch} />
  if (!project)
    return (
      <EmptyState
        title="Объект недоступен"
        action={
          <Link className="button secondary" to="/projects">
            К списку объектов
          </Link>
        }
      >
        Возможно, объект удалён или у вас больше нет доступа.
      </EmptyState>
    )
  async function deleteProject() {
    try {
      await remove({ id: project!.id, version: project!.version }).unwrap()
      navigate('/projects', { replace: true })
    } catch {
      /* Показано в диалоге. */
    }
  }
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={16} />
        Все объекты
      </Link>
      <div className="page-heading object-heading">
        <div>
          <span className="eyebrow">КАРТОЧКА ОБЪЕКТА</span>
          <h1>{project.name}</h1>
          <p className="address-line">
            <MapPin size={16} />
            {project.address}
          </p>
        </div>
        {manager && (
          <div className="action-group">
            <button className="button secondary" onClick={() => setDialog('edit')}>
              <Pencil size={16} />
              Изменить
            </button>
            <button
              className="icon-button bordered danger-text"
              aria-label="Удалить объект"
              title="Удалить объект"
              onClick={() => setDialog('delete')}
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>
      <section className="content-panel">
        <div className="section-toolbar">
          <div>
            <span className="eyebrow">РАБОТЫ НА ОБЪЕКТЕ</span>
            <h2>
              Задачи <span className="counter">{tasks.data?.length ?? '—'}</span>
            </h2>
          </div>
          {manager && (
            <button className="button primary" onClick={() => setDialog('task')}>
              <Plus size={17} />
              Новая задача
            </button>
          )}
        </div>
        {tasks.isLoading || tasks.isUninitialized ? (
          <Loading />
        ) : tasks.error ? (
          <ErrorState error={tasks.error} retry={tasks.refetch} />
        ) : (
          <TaskList tasks={tasks.data ?? []} />
        )}
      </section>
      {dialog === 'edit' && <ProjectForm project={project} onClose={() => setDialog(null)} />}
      {dialog === 'task' && <TaskForm projectId={projectId} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <DeleteDialog
          title="Удалить объект?"
          busy={removal.isLoading}
          error={removal.error}
          onClose={() => setDialog(null)}
          onDelete={() => void deleteProject()}
        >
          Объект «{project.name}», все его задачи и их история будут удалены. Это действие нельзя
          отменить.
        </DeleteDialog>
      )}
    </>
  )
}
