import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { checked, demoClients } from './demo-client.mjs'
const { manager, ivan, maria, url, key } = await demoClients()
const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) =>
  r.json(),
)
assert.equal(settings.disable_signup, true, 'Открытая регистрация должна быть отключена')
const anon = createClient(url, key, { auth: { persistSession: false } })
assert.ok((await anon.from('tasks').select('*')).error, 'Запрет чтения без входа')
const mine = checked(
  await ivan.client
    .from('tasks')
    .select(
      '*, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(*), author:profiles!tasks_author_id_fkey(*)',
    ),
)
assert.ok(mine.length > 0)
assert.ok(
  mine.every(
    (task) => task.assignee_id === ivan.id && task.project && task.assignee && task.author,
  ),
)
const foreign = checked(await maria.client.from('tasks').select('id').limit(1))[0]
assert.equal(checked(await ivan.client.from('tasks').select('*').eq('id', foreign.id)).length, 0)
assert.equal(
  checked(await ivan.client.from('task_history').select('*').eq('task_id', foreign.id)).length,
  0,
)
assert.ok((await ivan.client.from('profiles').update({ role: 'manager' }).eq('id', ivan.id)).error)
assert.ok((await manager.client.from('task_history').delete().eq('task_id', foreign.id)).error)
const projectId = crypto.randomUUID()
const taskId = crypto.randomUUID()
let project
try {
  project = checked(
    await manager.client.rpc('save_project', {
      p_id: projectId,
      p_name: 'Проверка API',
      p_address: 'Тестовый адрес',
    }),
  )
  const createArgs = {
    p_id: taskId,
    p_title: 'Проверка транзакций',
    p_description: '',
    p_project_id: projectId,
    p_assignee_id: ivan.id,
  }
  const creates = await Promise.all([
    manager.client.rpc('save_task', createArgs),
    manager.client.rpc('save_task', createArgs),
  ])
  assert.ok(
    creates.every((r) => !r.error),
    'Параллельное повторное создание',
  )
  const sameRequest = {
    p_task_id: taskId,
    p_status: 'in_progress',
    p_expected_version: 1,
    p_request_id: crypto.randomUUID(),
  }
  const repeats = await Promise.all([
    ivan.client.rpc('change_task_status', sameRequest),
    ivan.client.rpc('change_task_status', sameRequest),
  ])
  assert.ok(
    repeats.every((r) => !r.error && r.data.version === 2),
    'Параллельный повтор перехода',
  )
  assert.equal(
    checked(await ivan.client.from('task_history').select('*').eq('task_id', taskId)).length,
    2,
  )
  const concurrent = await Promise.all(
    [0, 1].map(() =>
      ivan.client.rpc('change_task_status', {
        p_task_id: taskId,
        p_status: 'in_review',
        p_expected_version: 2,
        p_request_id: crypto.randomUUID(),
      }),
    ),
  )
  assert.equal(
    concurrent.filter((r) => !r.error).length,
    1,
    'Только один запрос сохраняет актуальную версию',
  )
  assert.equal(concurrent.find((r) => r.error).error.message, 'VERSION_CONFLICT')
  assert.ok(
    (
      await ivan.client.rpc('change_task_status', {
        p_task_id: taskId,
        p_status: 'accepted',
        p_expected_version: 3,
        p_request_id: crypto.randomUUID(),
      })
    ).error,
  )
  checked(
    await manager.client.rpc('change_task_status', {
      p_task_id: taskId,
      p_status: 'accepted',
      p_expected_version: 3,
      p_request_id: crypto.randomUUID(),
    }),
  )
  const task = checked(
    await manager.client
      .from('tasks')
      .select('*, history:task_history(*, actor:profiles!task_history_actor_id_fkey(*))')
      .eq('id', taskId)
      .single(),
  )
  assert.equal(task.status, 'accepted')
  assert.equal(task.history.length, 4)
  assert.ok(task.history.every((event) => event.actor))
  console.log(
    'API: вход трёх пользователей, запрет регистрации, RLS, вложенные связи, защита истории, повторы и параллельные изменения — OK.',
  )
} finally {
  if (project)
    checked(
      await manager.client.rpc('delete_project', {
        p_id: projectId,
        p_expected_version: project.version,
      }),
    )
}
