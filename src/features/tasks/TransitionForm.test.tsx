import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskRow, TransitionInput } from '../../shared/api/types'
import { TransitionForm } from './TransitionForm'
const { mutation, unwrap } = vi.hoisted(() => ({ mutation: vi.fn(), unwrap: vi.fn() }))
vi.mock('../../shared/api/crm-api', () => ({
  useTransitionTaskMutation: () => [mutation, { isLoading: false, error: { message: 'Нет сети' } }],
}))
const task = { id: 'task-1', title: 'Проверить стены', version: 3 } as TaskRow
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
beforeEach(() => {
  mutation.mockReset()
  unwrap.mockReset()
  mutation.mockReturnValue({ unwrap })
  unwrap.mockRejectedValue({ message: 'Нет сети' })
})
describe('смена статуса после сетевой ошибки', () => {
  it('повторяет запрос с тем же ключом и сохраняет комментарий', async () => {
    const user = userEvent.setup()
    render(<TransitionForm task={task} target="revision" onClose={vi.fn()} />)
    const comment = screen.getByRole('textbox', { name: 'Что нужно доработать?' })
    await user.type(comment, 'Исправить стык')
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))
    const first = mutation.mock.calls[0][0] as TransitionInput
    const second = mutation.mock.calls[1][0] as TransitionInput
    expect(first.requestId).toBe(second.requestId)
    expect(first.comment).toBe('Исправить стык')
    expect(comment).toHaveValue('Исправить стык')
    expect(first.version).toBe(3)
    await user.type(comment, '!')
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))
    expect(mutation.mock.calls[2][0].requestId).not.toBe(first.requestId)
  })
  it('после успешного запроса закрывает форму', async () => {
    unwrap.mockResolvedValue({})
    const close = vi.fn()
    render(<TransitionForm task={task} target="accepted" onClose={close} />)
    fireEvent.submit(screen.getByRole('button', { name: 'Подтвердить' }).closest('form')!)
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })
  it('требует комментарий при возврате', () => {
    render(<TransitionForm task={task} target="revision" onClose={vi.fn()} />)
    expect(screen.getByRole('textbox')).toBeRequired()
  })
})
