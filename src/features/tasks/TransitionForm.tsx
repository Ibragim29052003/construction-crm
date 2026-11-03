import { useRef, useState, type FormEvent } from 'react'
import { useTransitionTaskMutation } from '../../shared/api/crm-api'
import type { TaskRow, TaskStatus, TransitionInput } from '../../shared/api/types'
import { Dialog, FormError, SaveButton } from '../../shared/ui/primitives'
import { STATUS } from './status'
export function TransitionForm({
  task,
  target,
  onClose,
}: {
  task: TaskRow
  target: TaskStatus
  onClose: () => void
}) {
  const [transition, state] = useTransitionTaskMutation()
  const [comment, setComment] = useState('')
  const previous = useRef<TransitionInput | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.isLoading) return
    const text = comment.trim() || null
    // Повтор после сетевой ошибки использует тот же ключ, пока текст не изменён.
    const input =
      previous.current && previous.current.comment === text
        ? previous.current
        : {
            taskId: task.id,
            status: target,
            version: task.version,
            requestId: crypto.randomUUID(),
            comment: text,
          }
    previous.current = input
    try {
      await transition(input).unwrap()
      onClose()
    } catch {
      /* Сохраняем комментарий и ключ для повтора. */
    }
  }
  return (
    <Dialog title={STATUS[target].action} onClose={onClose} busy={state.isLoading}>
      <p className="dialog-description">{task.title}</p>
      <form onSubmit={submit}>
        <fieldset disabled={state.isLoading}>
          <label>
            {target === 'revision' ? 'Что нужно доработать?' : 'Комментарий (необязательно)'}
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={2000}
              required={target === 'revision'}
              autoFocus
              placeholder={
                target === 'revision'
                  ? 'Опишите замечания, чтобы исполнитель мог их исправить'
                  : 'Добавьте детали, если нужно'
              }
            />
          </label>
          {target === 'revision' && (
            <p className="form-hint">Комментарий обязателен и останется в истории задачи.</p>
          )}
          <FormError error={state.error} />
          <div className="dialog-actions">
            <button className="button secondary" type="button" onClick={onClose}>
              Отмена
            </button>
            <SaveButton busy={state.isLoading}>Подтвердить</SaveButton>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
