import { CheckCheck } from 'lucide-react'
import { useGetTasksQuery } from '../../shared/api/crm-api'
import { ErrorState, Loading } from '../../shared/ui/primitives'
import { useProfile } from '../auth/auth-context'
import { TaskList } from './TaskList'
export function MyTasksPage() {
  const profile = useProfile()
  const query = useGetTasksQuery({ assigneeId: profile.id })
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЛИЧНЫЙ ПЛАН РАБОТ</span>
          <h1>
            Мои задачи<span className="heading-dot">.</span>
          </h1>
          <p>Всё, что назначено вам, в одном месте.</p>
        </div>
        <span className="page-emblem">
          <CheckCheck size={30} />
        </span>
      </div>
      <section className="content-panel">
        <div className="section-toolbar">
          <h2>
            Назначенные задачи <span className="counter">{query.data?.length ?? '—'}</span>
          </h2>
        </div>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={query.refetch} />
        ) : (
          <TaskList tasks={query.data ?? []} showProject />
        )}
      </section>
    </>
  )
}
