import { useState, type FormEvent } from 'react'
import { ArrowUpRight, Building2, Eye, EyeOff, Layers3, LockKeyhole } from 'lucide-react'
import { supabase } from '../../shared/api/supabase'
import { toApiError } from '../../shared/api/errors'
import { FormError, SaveButton } from '../../shared/ui/primitives'
export function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [showPassword, setShowPassword] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(data.get('email')).trim(),
        password: String(data.get('password')),
      })
      if (error) setError(toApiError(error))
    } catch (error) {
      setError(toApiError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story" aria-label="О системе">
        <div className="brand">
          <span className="brand-icon">
            <Layers3 size={23} />
          </span>
          контур<span className="brand-dot">.</span>
        </div>
        <div className="story-copy">
          <span className="eyebrow">ПОРЯДОК НА КАЖДОМ ЭТАПЕ</span>
          <h1>
            Все объекты.
            <br />
            Одна команда.
          </h1>
          <p>
            От первой задачи до принятой работы.
            <br />
            Держите строительство под контролем.
          </p>
          <div className="story-line" />
          <div className="story-steps">
            <span>
              01 <b>Поставить</b>
            </span>
            <span>
              02 <b>Выполнить</b>
            </span>
            <span>
              03 <b>Принять</b>
            </span>
          </div>
        </div>
        <div className="story-footer">
          <Building2 size={18} />
          Рабочее пространство строительной команды
          <ArrowUpRight size={18} />
        </div>
        <div className="building-art" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="login-kicker">
            <span />
            ОБЪЕКТЫ И ЗАДАЧИ
          </span>
          <h2>С возвращением</h2>
          <p className="muted">Войдите в рабочее пространство команды.</p>
          <form id="login-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.ru"
                  required
                  maxLength={254}
                  autoFocus
                />
              </label>
              <div className="password-control">
                <label htmlFor="login-password">Пароль</label>
                <div className="password-field">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Введите пароль"
                    required
                    maxLength={128}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <FormError error={error} />
              <SaveButton busy={busy}>Войти</SaveButton>
            </fieldset>
          </form>
          <div className="login-note">
            <LockKeyhole size={18} />
            <p>
              Доступ только для сотрудников.
              <br />
              Для получения учётной записи обратитесь к руководителю.
            </p>
          </div>
        </div>
        <span className="login-bottom">КОНТУР / МИНИ-CRM</span>
      </section>
    </main>
  )
}
