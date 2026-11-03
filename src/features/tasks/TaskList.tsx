import { StatusBadge } from './StatusBadge'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import type { TaskRow, TaskStatus } from '../../shared/api/types'
import { EmptyState } from '../../shared/ui/primitives'
import { initials } from '../../shared/ui/format'
import { STATUS } from './status'
export function TaskList({
  tasks,
  showProject = false,
}: {
  tasks: TaskRow[]
  showProject?: boolean
}) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const filtered = tasks.filter(
    (task) =>
      (!status || task.status === status) &&
      task.title.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru').trim()),
  )
  return (
    <>
      <div className="task-filters">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Найти задачу</span>
          <input
            type="search"
            placeholder="Найти задачу"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="status-filter">
          <span className="sr-only">Фильтр по статусу</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Все статусы</option>
            {(Object.keys(STATUS) as TaskStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS[key].label}
              </option>
            ))}
          </select>
        </label>
        <span className="filter-count">
          Показано: {filtered.length} из {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="Задач пока нет">Здесь появятся задачи по объекту.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Нет подходящих задач">
          Измените поиск или выберите другой статус.
        </EmptyState>
      ) : (
        <div className="task-table">
          <div className="task-table-head" aria-hidden="true">
            <span>Задача / {showProject ? 'Объект' : 'Описание'}</span>
            <span>Исполнитель</span>
            <span>Статус</span>
            <span />
          </div>
          <ul>
            {filtered.map((task) => (
              <li key={task.id}>
                <Link className="task-row" to={`/tasks/${task.id}`}>
                  <div className="task-row-title">
                    <strong>{task.title}</strong>
                    <span>
                      {showProject ? task.project.name : task.description || 'Без описания'}
                    </span>
                  </div>
                  <span className="task-assignee">
                    <span className="avatar small">{initials(task.assignee.display_name)}</span>
                    <span>{task.assignee.display_name}</span>
                  </span>
                  <StatusBadge status={task.status} />
                  <ArrowUpRight size={18} className="task-row-arrow" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
