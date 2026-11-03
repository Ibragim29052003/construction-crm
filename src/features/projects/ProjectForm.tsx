import { useState, type FormEvent } from 'react'
import { useSaveProjectMutation } from '../../shared/api/crm-api'
import type { Project } from '../../shared/api/types'
import { Dialog, FormError, SaveButton } from '../../shared/ui/primitives'
export function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const [id] = useState(() => project?.id ?? crypto.randomUUID())
  const [save, state] = useSaveProjectMutation()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.isLoading) return
    const data = new FormData(event.currentTarget)
    try {
      await save({
        id,
        name: String(data.get('name')).trim(),
        address: String(data.get('address')).trim(),
        version: project?.version,
      }).unwrap()
      onClose()
    } catch {
      /* Ошибка остаётся рядом с формой. */
    }
  }
  return (
    <Dialog
      title={project ? 'Редактировать объект' : 'Новый объект'}
      onClose={onClose}
      busy={state.isLoading}
    >
      <form onSubmit={submit}>
        <fieldset disabled={state.isLoading}>
          <label>
            Название объекта
            <input
              name="name"
              defaultValue={project?.name}
              required
              pattern=".*\S.*"
              maxLength={160}
              placeholder="Например, ЖК «Сосновый»"
              autoFocus
            />
          </label>
          <label>
            Адрес
            <input
              name="address"
              defaultValue={project?.address}
              required
              pattern=".*\S.*"
              maxLength={300}
              placeholder="Город, улица, дом"
            />
          </label>
          <FormError error={state.error} />
          <div className="dialog-actions">
            <button className="button secondary" type="button" onClick={onClose}>
              Отмена
            </button>
            <SaveButton busy={state.isLoading}>
              {project ? 'Сохранить' : 'Создать объект'}
            </SaveButton>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
