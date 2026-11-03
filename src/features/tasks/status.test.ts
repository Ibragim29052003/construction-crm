import { describe, expect, it } from 'vitest'
import { availableTransitions } from './status'
import type { Role, TaskStatus } from '../../shared/api/types'
const statuses: TaskStatus[] = ['new', 'in_progress', 'in_review', 'accepted', 'revision']
describe('действия в карточке задачи', () => {
  const allowed: Record<Role, Partial<Record<TaskStatus, TaskStatus[]>>> = {
    manager: { in_review: ['accepted', 'revision'] },
    executor: { new: ['in_progress'], revision: ['in_progress'], in_progress: ['in_review'] },
  }
  for (const role of ['manager', 'executor'] as const) {
    for (const status of statuses) {
      it(`${role}: ${status}`, () =>
        expect(availableTransitions(role, status, true)).toEqual(allowed[role][status] ?? []))
    }
  }
  it('постороннему исполнителю недоступны действия', () => {
    for (const status of statuses)
      expect(availableTransitions('executor', status, false)).toEqual([])
  })
})
