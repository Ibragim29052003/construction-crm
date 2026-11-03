import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, CheckCheck, Layers3, LogOut, ShieldCheck } from 'lucide-react'
import { useProfile } from '../features/auth/auth-context'
import { supabase } from '../shared/api/supabase'
import { toApiError } from '../shared/api/errors'
import { FormError } from '../shared/ui/primitives'
import { initials } from '../shared/ui/format'
export function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('main-content')?.focus()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  const profile = useProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) setError(toApiError(error))
    } catch (error) {
      setError(toApiError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="app-shell">
      <button
        className="skip-link"
        onClick={() => document.getElementById('main-content')?.focus()}
      >
        Перейти к содержимому
      </button>
      <aside className="sidebar">
        <NavLink to="/projects" className="brand" aria-label="Контур — на главную">
          <span className="brand-icon">
            <Layers3 size={22} />
          </span>
          контур<span className="brand-dot">.</span>
        </NavLink>
        <p className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav aria-label="Основная навигация">
          <NavLink to="/projects">
            <Building2 size={19} />
            Объекты
          </NavLink>
          {profile.role === 'executor' && (
            <NavLink to="/my-tasks">
              <CheckCheck size={19} />
              Мои задачи
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="access-note">
            <ShieldCheck size={19} />
            <p>
              {profile.role === 'manager' ? 'Все объекты команды' : 'Только назначенные вам задачи'}
              <span>Доступ по вашей роли</span>
            </p>
          </div>
          <div className="profile">
            <span className="avatar">{initials(profile.display_name)}</span>
            <div>
              <strong>{profile.display_name}</strong>
              <span>{profile.role === 'manager' ? 'Постановщик' : 'Исполнитель'}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Выйти из аккаунта"
              title="Выйти"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut size={18} />
            </button>
          </div>
          <FormError error={error} />
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>Строительная команда</span>
          <span className="topbar-label">
            <span />
            ОБЪЕКТЫ И ЗАДАЧИ
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>Контур — объекты и задачи</span>
          <span>От задачи к результату</span>
        </footer>
      </div>
    </div>
  )
}
