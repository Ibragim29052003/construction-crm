import { checked, demoClients } from './demo-client.mjs'
const { manager, ivan, maria } = await demoClients()
const projects = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'ЖК «Сосновый»',
    address: 'Москва, Сосновая улица, 12',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Бизнес-центр «Горизонт»',
    address: 'Москва, проспект Мира, 84',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Школа № 128',
    address: 'Москва, Берёзовая аллея, 7',
  },
]
for (const p of projects)
  checked(
    await manager.client.rpc('save_project', { p_id: p.id, p_name: p.name, p_address: p.address }),
  )
const tasks = [
  [
    'Проверить разметку перегородок',
    'Сверить оси и размеры помещений второго этажа с рабочим проектом. Зафиксировать отклонения до начала кладки.',
    0,
    ivan,
    'new',
  ],
  [
    'Подготовить стены под отделку',
    'Удалить наплывы раствора, проверить плоскость стен. Особое внимание — примыканиям у оконных проёмов.',
    0,
    ivan,
    'in_progress',
  ],
  [
    'Проверить монтаж электрики',
    'Осмотреть щитовую и кабельные трассы первого этажа. Подготовить список замечаний для приёмки.',
    0,
    maria,
    'in_review',
  ],
  [
    'Принять гидроизоляцию санузлов',
    'Проверить сплошность покрытия и высоту заведения на стены. Результат приложен в рабочем журнале.',
    0,
    maria,
    'accepted',
  ],
  [
    'Согласовать узел примыкания фасада',
    'Проверить монтажный узел северного фасада по чертежу АР-14. Уточнить размеры компенсационного зазора.',
    1,
    ivan,
    'revision',
  ],
  [
    'Подготовить ведомость материалов',
    'Составить перечень отделочных материалов для входной группы. Проверить объёмы по актуальным чертежам.',
    1,
    ivan,
    'new',
  ],
  [
    'Проверить укладку напольного покрытия',
    'Осмотреть коридоры первого этажа: стыки, плинтусы, примыкания. Проверить отсутствие перепадов.',
    2,
    maria,
    'in_progress',
  ],
  [
    'Принять освещение в классах',
    'Проверить включение всех групп светильников и соответствие размещения проекту.',
    2,
    maria,
    'in_review',
  ],
]
for (const [i, [title, description, projectIndex, assignee, target]] of tasks.entries()) {
  const id = `30000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
  const existing = checked(
    await manager.client.from('tasks').select('id').eq('id', id).maybeSingle(),
  )
  if (existing) continue
  let task = checked(
    await manager.client.rpc('save_task', {
      p_id: id,
      p_title: title,
      p_description: description,
      p_project_id: projects[projectIndex].id,
      p_assignee_id: assignee.id,
    }),
  )
  const path =
    target === 'new'
      ? []
      : target === 'in_progress'
        ? ['in_progress']
        : target === 'in_review'
          ? ['in_progress', 'in_review']
          : ['in_progress', 'in_review', target]
  for (const status of path) {
    const actor = ['accepted', 'revision'].includes(status) ? manager : assignee
    task = checked(
      await actor.client.rpc('change_task_status', {
        p_task_id: id,
        p_status: status,
        p_expected_version: task.version,
        p_request_id: crypto.randomUUID(),
        p_comment:
          status === 'revision'
            ? 'Уточните размер зазора по чертежу АР-14 и повторно проверьте крепления в зоне примыкания.'
            : undefined,
      }),
    )
  }
}
console.log('Готово: 3 объекта, 8 задач, все пять статусов. Существующие задачи не изменены.')
