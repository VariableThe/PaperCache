import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useReminders } from './useReminders'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { useAppStore } from '../store/useAppStore'

// Mock @tauri-apps/api/event so the listen() call doesn't fail in jsdom
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

describe('useReminders', () => {
  const scheduleRemindersMock = vi.fn().mockResolvedValue(undefined)
  const cancelRemindersMock = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock window.electronAPI with the new Rust-backed interface
    window.electronAPI = {
      scheduleReminders: scheduleRemindersMock,
      cancelReminders: cancelRemindersMock,
      onPowerSuspend: vi.fn().mockReturnValue(vi.fn()),
      onPowerResume: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as Window['electronAPI']

    localStorage.clear()
    vi.clearAllMocks()
    useAppStore.setState({ notes: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should call scheduleReminders with future pending reminders on mount', async () => {
    const d = new Date(Date.now() + 600000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const futureDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    await act(async () => {
      useAppStore.setState({
        notes: [{ id: '1', content: `/task Buy bread @ ${futureDate}`, mtime: 0 }],
      })
    })

    renderHook(() => useReminders())

    // Should have called the backend to schedule the reminder
    expect(scheduleRemindersMock).toHaveBeenCalledTimes(1)
    const reminders = scheduleRemindersMock.mock.calls[0][0] as {
      key: string
      label: string
      dueAt: number
    }[]
    expect(reminders.length).toBe(1)
    expect(reminders[0].label).toBe('Buy bread')
    expect(reminders[0].dueAt).toBeGreaterThan(Date.now())
  })

  it('should NOT schedule past-due reminders (already notified by backend on last run)', async () => {
    const d = new Date(Date.now() - 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const pastDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    await act(async () => {
      useAppStore.setState({
        notes: [{ id: '1', content: `/task Buy milk @ ${pastDate}`, mtime: 0 }],
      })
    })

    renderHook(() => useReminders())

    // Called but with empty array – past reminders are not re-scheduled
    expect(scheduleRemindersMock).toHaveBeenCalledTimes(1)
    const reminders = scheduleRemindersMock.mock.calls[0][0] as unknown[]
    expect(reminders.length).toBe(0)
  })

  it('should not schedule notifications for completed tasks', async () => {
    const d = new Date(Date.now() + 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const futureDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    await act(async () => {
      useAppStore.setState({
        notes: [{ id: '1', content: `/task-done Buy milk @ ${futureDate}`, mtime: 0 }],
      })
    })

    renderHook(() => useReminders())

    const reminders = scheduleRemindersMock.mock.calls[0][0] as unknown[]
    expect(reminders.length).toBe(0)
  })

  it('should mark a reminder as notified when reminder-fired event is received', async () => {
    const { listen } = await import('@tauri-apps/api/event')
    let capturedCallback: ((e: { payload: string }) => void) | undefined

    vi.mocked(listen).mockImplementation((_event, cb) => {
      capturedCallback = cb as (e: { payload: string }) => void
      return Promise.resolve(() => {})
    })

    const d = new Date(Date.now() + 600000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const futureDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    const reminderKey = `1-${d.getTime()}-Buy coffee`

    await act(async () => {
      useAppStore.setState({
        notes: [{ id: '1', content: `/task Buy coffee @ ${futureDate}`, mtime: 0 }],
      })
    })

    renderHook(() => useReminders())

    // Simulate the backend firing the reminder
    await act(async () => {
      capturedCallback?.({ payload: reminderKey })
    })

    const notified = JSON.parse(localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS) || '[]')
    expect(notified).toContain(reminderKey)
  })

  it('should call cancelReminders on unmount', () => {
    const { unmount } = renderHook(() => useReminders())
    unmount()
    expect(cancelRemindersMock).toHaveBeenCalled()
  })
})
