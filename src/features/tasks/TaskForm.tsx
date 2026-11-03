import { useState, type FormEvent } from 'react'
import {
  useGetExecutorsQuery,
  useGetProjectsQuery,
  useSaveTaskMutation,
} from '../../shared/api/crm-api'
import type { TaskRow } from '../../shared/api/types'
import { Dialog, ErrorState, FormError, Loading, SaveButton } from '../../shared/ui/primitives'
export function TaskForm({
  task,
  projectId,
  onClose,
}: {
  task?: TaskRow
  projectId?: string
  onClose: () => void
}) {
  const [id] = useState(() => task?.id ?? crypto.randomUUID())
  const executors = useGetExecutorsQuery()
  const projects = useGetProjectsQuery()
  const [save, state] = useSaveTaskMutation()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.isLoading) return
    const data = new FormData(event.currentTarget)
    try {
      await save({
        id,
        title: String(data.get('title')).trim(),
        description: String(data.get('description')).trim(),
        project_id: String(data.get('project')),
        assignee_id: String(data.get('assignee')),
        version: task?.version,
      }).unwrap()
      onClose()
    } catch {
      /* Сохраняем форму при ошибке. */
    }
  }
  const error = executors.error || projects.error
  return (
    <Dialog
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      onClose={onClose}
      busy={state.isLoading}
    >
      {error ? (
        <ErrorState
          error={error}
          retry={() => {
            void executors.refetch()
            void projects.refetch()
          }}
        />
      ) : executors.isLoading || projects.isLoading ? (
        <Loading />
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={state.isLoading}>
            <label>
              Название
              <input
                name="title"
                defaultValue={task?.title}
                required
                pattern=".*\S.*"
                maxLength={200}
                placeholder="Что нужно сделать?"
                autoFocus
              />
            </label>
            <label>
              Описание
              <textarea
                name="description"
                defaultValue={task?.description}
                rows={4}
                maxLength={5000}
                placeholder="Детали, требования и ожидаемый результат"
              />
            </label>
            <div className="form-columns">
              <label>
                Объект
                <select name="project" required defaultValue={task?.project_id ?? projectId ?? ''}>
                  <option value="" disabled>
                    Выберите объект
                  </option>
                  {projects.data?.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Исполнитель
                <select name="assignee" required defaultValue={task?.assignee_id ?? ''}>
                  <option value="" disabled>
                    Выберите исполнителя
                  </option>
                  {executors.data?.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {executors.data?.length === 0 && (
              <p className="form-hint">
                Сначала администратору нужно добавить профиль исполнителя в базу.
              </p>
            )}
            <FormError error={state.error} />
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={onClose}>
                Отмена
              </button>
              <SaveButton busy={state.isLoading}>
                {task ? 'Сохранить' : 'Создать задачу'}
              </SaveButton>
            </div>
          </fieldset>
        </form>
      )}
    </Dialog>
  )
}
