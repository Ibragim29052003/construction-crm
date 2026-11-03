import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { supabase } from './supabase'
import { toApiError, type ApiError } from './errors'
import type {
  Profile,
  ProjectInput,
  ProjectSummary,
  TaskDetail,
  TaskInput,
  TaskRow,
  TransitionInput,
} from './types'

async function result<T>(request: PromiseLike<{ data: T | null; error: unknown }>) {
  try {
    const { data, error } = await request
    if (error) return { error: toApiError(error) }
    if (data == null)
      return { error: { message: 'Запись не найдена или недоступна.', code: 'NOT_FOUND' } }
    return { data }
  } catch (error) {
    return { error: toApiError(error) }
  }
}
const taskSelect =
  '*, assignee:profiles!tasks_assignee_id_fkey(*), author:profiles!tasks_author_id_fkey(*), project:projects(id,name)'
export const crmApi = createApi({
  reducerPath: 'crmApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['Profile', 'Projects', 'Tasks', 'Task'],
  keepUnusedDataFor: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    getProfile: build.query<Profile, string>({
      queryFn: (id) => result(supabase.from('profiles').select('*').eq('id', id).single()),
      providesTags: ['Profile'],
    }),
    getExecutors: build.query<Profile[], void>({
      queryFn: () =>
        result(supabase.from('profiles').select('*').eq('role', 'executor').order('display_name')),
      providesTags: ['Profile'],
    }),
    getProjects: build.query<ProjectSummary[], void>({
      queryFn: () =>
        result(
          supabase
            .from('projects')
            .select('*, tasks(id,status)')
            .order('created_at', { ascending: false })
            .returns<ProjectSummary[]>(),
        ),
      providesTags: ['Projects'],
    }),
    getTasks: build.query<TaskRow[], { projectId?: string; assigneeId?: string }>({
      queryFn: ({ projectId, assigneeId }) => {
        let query = supabase
          .from('tasks')
          .select(taskSelect)
          .order('created_at', { ascending: false })
        if (projectId) query = query.eq('project_id', projectId)
        if (assigneeId) query = query.eq('assignee_id', assigneeId)
        return result(query.returns<TaskRow[]>())
      },
      providesTags: ['Tasks'],
    }),
    getTask: build.query<TaskDetail, string>({
      queryFn: (id) =>
        result(
          supabase
            .from('tasks')
            .select(
              `${taskSelect}, history:task_history(*, actor:profiles!task_history_actor_id_fkey(*))`,
            )
            .eq('id', id)
            .single()
            .overrideTypes<TaskDetail, { merge: false }>(),
        ),
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),
    saveProject: build.mutation<unknown, ProjectInput>({
      queryFn: (input) =>
        result(
          supabase.rpc('save_project', {
            p_id: input.id,
            p_name: input.name,
            p_address: input.address,
            p_expected_version: input.version,
          }),
        ),
      invalidatesTags: (_result, error) => (error ? [] : ['Projects', 'Tasks', 'Task']),
    }),
    deleteProject: build.mutation<null, { id: string; version: number }>({
      queryFn: async ({ id, version }) => {
        const { error } = await supabase.rpc('delete_project', {
          p_id: id,
          p_expected_version: version,
        })
        return error ? { error: toApiError(error) } : { data: null }
      },
      invalidatesTags: (_result, error) => (error ? [] : ['Projects', 'Tasks', 'Task']),
    }),
    saveTask: build.mutation<unknown, TaskInput>({
      queryFn: (input) =>
        result(
          supabase.rpc('save_task', {
            p_id: input.id,
            p_title: input.title,
            p_description: input.description,
            p_project_id: input.project_id,
            p_assignee_id: input.assignee_id,
            p_expected_version: input.version,
          }),
        ),
      invalidatesTags: (_result, error, input) =>
        error ? [] : ['Projects', 'Tasks', { type: 'Task', id: input.id }],
    }),
    deleteTask: build.mutation<null, { id: string; version: number }>({
      queryFn: async ({ id, version }) => {
        const { error } = await supabase.rpc('delete_task', {
          p_id: id,
          p_expected_version: version,
        })
        return error ? { error: toApiError(error) } : { data: null }
      },
      invalidatesTags: (_result, error) => (error ? [] : ['Projects', 'Tasks', 'Task']),
    }),
    transitionTask: build.mutation<unknown, TransitionInput>({
      queryFn: (input) =>
        result(
          supabase.rpc('change_task_status', {
            p_task_id: input.taskId,
            p_status: input.status,
            p_expected_version: input.version,
            p_request_id: input.requestId,
            p_comment: input.comment ?? undefined,
          }),
        ),
      invalidatesTags: (_result, error, input) =>
        error ? [] : ['Projects', 'Tasks', { type: 'Task', id: input.taskId }],
    }),
  }),
})
export const {
  useGetProfileQuery,
  useGetExecutorsQuery,
  useGetProjectsQuery,
  useGetTasksQuery,
  useGetTaskQuery,
  useSaveProjectMutation,
  useDeleteProjectMutation,
  useSaveTaskMutation,
  useDeleteTaskMutation,
  useTransitionTaskMutation,
} = crmApi
