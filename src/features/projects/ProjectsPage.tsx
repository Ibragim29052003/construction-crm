import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  CheckCheck,
  ClipboardList,
  MapPin,
  Plus,
  Search,
  Timer,
} from 'lucide-react'
import { useGetProjectsQuery } from '../../shared/api/crm-api'
import { EmptyState, ErrorState, Loading } from '../../shared/ui/primitives'
import { useProfile } from '../auth/auth-context'
import { ProjectForm } from './ProjectForm'
export function ProjectsPage() {
  const profile = useProfile()
  const query = useGetProjectsQuery()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const manager = profile.role === 'manager'
  const projects = query.data ?? []
  const allTasks = projects.flatMap((project) => project.tasks)
  const filtered = projects.filter((project) =>
    `${project.name} ${project.address}`
      .toLocaleLowerCase('ru')
      .includes(search.toLocaleLowerCase('ru').trim()),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ОБЗОР ПРОСТРАНСТВА</span>
          <h1>
            Объекты<span className="heading-dot">.</span>
          </h1>
          <p>
            {manager
              ? 'Стройки, задачи и прогресс вашей команды.'
              : 'Объекты, на которых вам назначены задачи.'}
          </p>
        </div>
        {manager && (
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={18} />
            Новый объект
          </button>
        )}
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <>
          <section className="stats-grid" aria-label="Сводка по доступным данным">
            <div className="stat">
              <span>
                Объекты
                <Building2 size={18} />
              </span>
              <strong>{projects.length.toString().padStart(2, '0')}</strong>
              <small>В рабочем пространстве</small>
            </div>
            <div className="stat">
              <span>
                Всего задач
                <ClipboardList size={18} />
              </span>
              <strong>{allTasks.length.toString().padStart(2, '0')}</strong>
              <small>{manager ? 'По всем объектам' : 'Назначено вам'}</small>
            </div>
            <div className="stat">
              <span>
                На проверке
                <Timer size={18} />
              </span>
              <strong>
                {allTasks
                  .filter((task) => task.status === 'in_review')
                  .length.toString()
                  .padStart(2, '0')}
              </strong>
              <small>Ожидают решения</small>
            </div>
            <div className="stat">
              <span>
                Принятые
                <CheckCheck size={18} />
              </span>
              <strong>
                {allTasks
                  .filter((task) => task.status === 'accepted')
                  .length.toString()
                  .padStart(2, '0')}
              </strong>
              <small>Работа выполнена</small>
            </div>
          </section>
          <section className="projects-section" aria-labelledby="projects-title">
            <div className="section-toolbar">
              <h2 id="projects-title">
                Все объекты <span className="counter">{projects.length}</span>
              </h2>
              <label className="search-field">
                <Search size={17} />
                <span className="sr-only">Поиск по названию или адресу</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по названию или адресу"
                />
              </label>
            </div>
            {projects.length === 0 ? (
              <EmptyState
                title="Здесь будут ваши объекты"
                action={
                  manager && (
                    <button className="button primary" onClick={() => setCreating(true)}>
                      <Plus size={17} />
                      Создать первый объект
                    </button>
                  )
                }
              >
                {manager
                  ? 'Добавьте стройку, чтобы назначить команде первые задачи.'
                  : 'Объекты появятся, когда руководитель назначит вам задачи.'}
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState title="Ничего не нашлось">
                Попробуйте другое название или адрес.
              </EmptyState>
            ) : (
              <div className="project-grid">
                {filtered.map((project, index) => {
                  const done = project.tasks.filter((task) => task.status === 'accepted').length
                  const progress = project.tasks.length
                    ? Math.round((done / project.tasks.length) * 100)
                    : 0
                  return (
                    <Link className="project-card" key={project.id} to={`/projects/${project.id}`}>
                      <div className="project-card-top">
                        <span className="project-symbol">
                          <Building2 size={24} strokeWidth={1.6} />
                        </span>
                        <span className="project-number">
                          ОБЪЕКТ {String(index + 1).padStart(2, '0')}
                        </span>
                        <ArrowUpRight className="card-arrow" size={20} />
                      </div>
                      <h3>{project.name}</h3>
                      <p className="project-address">
                        <MapPin size={15} />
                        {project.address}
                      </p>
                      <div className="project-progress">
                        <div>
                          <span>Принято задач</span>
                          <strong>
                            {done} <span>/ {project.tasks.length}</span>
                          </strong>
                        </div>
                        <div
                          className="progress-track"
                          role="progressbar"
                          aria-label={`Принято задач на объекте ${project.name}`}
                          aria-valuenow={done}
                          aria-valuemin={0}
                          aria-valuemax={project.tasks.length || 1}
                        >
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="project-card-footer">
                        <span>
                          {project.tasks.filter((task) => task.status === 'in_review').length >
                          0 ? (
                            <>
                              <span className="small-dot amber" />
                              Есть задачи на проверке
                            </>
                          ) : (
                            <>
                              <span className="small-dot" />
                              {project.tasks.length ? 'Задачи по объекту' : 'Пока без задач'}
                            </>
                          )}
                        </span>
                        <span>{progress}%</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
          <div className="workspace-tip">
            <span className="tip-mark">i</span>
            <p>
              {manager
                ? 'Задача считается завершённой после вашей приёмки. Работы на проверке ждут вашего решения.'
                : 'Выполнили задачу? Отправьте её на проверку. Руководитель примет работу или оставит комментарий.'}
            </p>
          </div>
        </>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </>
  )
}
