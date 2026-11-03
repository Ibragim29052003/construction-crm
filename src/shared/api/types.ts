export type Role = 'manager' | 'executor'
export type TaskStatus = 'new' | 'in_progress' | 'in_review' | 'accepted' | 'revision'
export interface Profile {
  id: string
  display_name: string
  role: Role
}
export interface Project {
  id: string
  name: string
  address: string
  created_by: string
  created_at: string
  version: number
}
export interface ProjectSummary extends Project {
  tasks: { id: string; status: TaskStatus }[]
}
export interface Task {
  id: string
  title: string
  description: string
  project_id: string
  assignee_id: string
  author_id: string
  status: TaskStatus
  created_at: string
  updated_at: string
  version: number
}
export interface TaskRow extends Task {
  assignee: Profile
  author: Profile
  project: { id: string; name: string }
}
export interface HistoryEntry {
  id: number
  task_id: string
  actor_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  actor: Profile
}
export interface TaskDetail extends TaskRow {
  history: HistoryEntry[]
}
export interface ProjectInput {
  id: string
  name: string
  address: string
  version?: number
}
export interface TaskInput {
  id: string
  title: string
  description: string
  project_id: string
  assignee_id: string
  version?: number
}
export interface TransitionInput {
  taskId: string
  status: TaskStatus
  version: number
  requestId: string
  comment: string | null
}
