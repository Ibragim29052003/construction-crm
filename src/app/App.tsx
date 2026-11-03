import { Component, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { store } from './store'
import { Layout } from './Layout'
import { AuthProvider } from '../features/auth/AuthProvider'
import { useProfile } from '../features/auth/auth-context'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { ProjectPage } from '../features/projects/ProjectPage'
import { TaskPage } from '../features/tasks/TaskPage'
import { MyTasksPage } from '../features/tasks/MyTasksPage'
import { isConfigured } from '../shared/api/supabase'
function ExecutorTasks() {
  return useProfile().role === 'executor' ? <MyTasksPage /> : <Navigate to="/projects" replace />
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="setup-screen">
        <h1>Не удалось открыть страницу</h1>
        <p>Обновите страницу, чтобы попробовать ещё раз.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Обновить страницу
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
export function App() {
  if (!isConfigured)
    return (
      <main className="setup-screen">
        <Building2 size={40} />
        <h1>Контур — объекты и задачи</h1>
        <p>Подключите проект Supabase, чтобы начать работу.</p>
        <p className="muted">
          Укажите VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в .env.local, затем
          перезапустите приложение. Инструкция — в README.
        </p>
      </main>
    )
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/projects" replace />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:projectId" element={<ProjectPage />} />
                <Route path="tasks/:taskId" element={<TaskPage />} />
                <Route path="my-tasks" element={<ExecutorTasks />} />
                <Route
                  path="*"
                  element={
                    <div className="empty-state">
                      <h1>Страница не найдена</h1>
                      <Link to="/projects" className="button secondary">
                        К объектам
                      </Link>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </HashRouter>
        </AuthProvider>
      </Provider>
    </ErrorBoundary>
  )
}
