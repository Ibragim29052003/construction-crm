import type { ReactNode } from 'react'
import { Dialog, FormError } from './primitives'
export function DeleteDialog({
  title,
  children,
  busy,
  error,
  onClose,
  onDelete,
}: {
  title: string
  children: ReactNode
  busy: boolean
  error: unknown
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <p className="delete-warning">{children}</p>
      <FormError error={error} />
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose} disabled={busy} autoFocus>
          Отмена
        </button>
        <button className="button danger" onClick={onDelete} disabled={busy}>
          {busy ? 'Удаляем…' : 'Удалить'}
        </button>
      </div>
    </Dialog>
  )
}
