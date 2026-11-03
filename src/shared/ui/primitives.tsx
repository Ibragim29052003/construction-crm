import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Building2, RefreshCw, X } from 'lucide-react'
import { errorMessage } from '../api/errors'
export function Loading({ label = 'Загружаем данные…' }: { label?: string }) {
  return (
    <div className="state-block" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Не получилось загрузить данные</strong>
        <p>{errorMessage(error)}</p>
        {retry && (
          <button className="button secondary" onClick={retry}>
            <RefreshCw size={15} />
            Повторить
          </button>
        )}
      </div>
    </div>
  )
}
export function FormError({ error }: { error: unknown }) {
  return error ? (
    <p className="form-error" role="alert">
      <AlertCircle size={16} />
      {errorMessage(error)}
    </p>
  ) : null
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Building2 size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialog.showModal()
    dialog.querySelector<HTMLElement>('input, textarea, select')?.focus()
    return () => {
      dialog.close()
      previouslyFocused?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose()
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" onClick={onClose} disabled={busy} aria-label="Закрыть">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function SaveButton({
  busy,
  children = 'Сохранить',
}: {
  busy: boolean
  children?: ReactNode
}) {
  return (
    <button className="button primary" type="submit" disabled={busy}>
      {busy ? (
        <>
          <span className="spinner" />
          Сохраняем…
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={16} />
        </>
      )}
    </button>
  )
}
