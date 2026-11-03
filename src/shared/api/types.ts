import type { Enums, Tables } from './database.types'

export type Role = Enums<'user_role'>
export type TaskStatus = Enums<'task_status'>
export type Profile = Tables<'profiles'>
export type Project = Tables<'projects'>
export type Task = Tables<'tasks'>
export interface ProjectSummary extends Project {
  tasks: { id: string; status: TaskStatus }[]
}
export interface TaskRow extends Task {
  assignee: Profile
  author: Profile
  project: { id: string; name: string }
}
export interface HistoryEntry extends Tables<'task_history'> {
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
