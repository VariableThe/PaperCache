import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useReminders } from './useReminders'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { useAppStore } from '../store/useAppStore'

describe('useReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Mock Notification
    globalThis.Notification = Object.assign(vi.fn(), {
      requestPermission: vi.fn().mockResolvedValue('granted'),
      permission: 'granted' as NotificationPermission,
    })

    // Mock electronAPI if not present
    if (!window.electronAPI) {
      window.electronAPI = {
        onPowerSuspend: vi.fn().mockReturnValue(vi.fn()),
        onPowerResume: vi.fn().mockReturnValue(vi.fn()),
      } as Partial<Window['electronAPI']> as any
    }

    // Clear localStorage
    localStorage.clear()

    // Clear mocks
    vi.clearAllMocks()

    // Reset state
    useAppStore.setState({ notes: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should request notification permission if not granted', () => {
    Object.defineProperty(Notification, 'permission', {
      value: 'default',
      configurable: true,
    })

    renderHook(() => useReminders())
    expect(Notification.requestPermission).toHaveBeenCalled()
  })

  it('should trigger notification for due reminders', () => {
    const d = new Date(Date.now() - 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const pastDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    useAppStore.setState({
      notes: [
        {
          id: '1',
          content: `/task Buy milk @ ${pastDate}`,
          mtime: 0,
        },
      ],
    })

    renderHook(() => useReminders())

    expect(Notification).toHaveBeenCalledWith('PaperCache Reminder', {
      body: 'Buy milk',
      silent: false,
    })

    // Check that it's saved in localStorage
    const notified = JSON.parse(localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS) || '[]')
    expect(notified.length).toBe(1)
  })

  it('should schedule notification for future reminders', () => {
    const d2 = new Date(Date.now() + 600000)
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const futureDate = `${d2.getFullYear()}-${pad2(d2.getMonth() + 1)}-${pad2(d2.getDate())} ${pad2(d2.getHours())}:${pad2(d2.getMinutes())}`
    useAppStore.setState({
      notes: [
        {
          id: '1',
          content: `/task (2025-01-01 10:00) Buy bread @ ${futureDate}`,
          mtime: 0,
        },
      ],
    })

    renderHook(() => useReminders())

    // Should not trigger yet
    expect(Notification).not.toHaveBeenCalled()

    // Fast-forward time
    vi.advanceTimersByTime(605000)

    // Now it should trigger
    expect(Notification).toHaveBeenCalledWith('PaperCache Reminder', {
      body: 'Buy bread',
      silent: false,
    })
  })

  it('should not trigger notification for completed tasks', () => {
    const d = new Date(Date.now() - 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const pastDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    useAppStore.setState({
      notes: [
        {
          id: '1',
          content: `/task-done Buy milk @ ${pastDate}`,
          mtime: 0,
        },
      ],
    })

    renderHook(() => useReminders())

    expect(Notification).not.toHaveBeenCalled()
  })

  it('should handle power suspend and resume', () => {
    const suspendMock = vi.fn()
    const resumeMock = vi.fn()

    window.electronAPI.onPowerSuspend = suspendMock.mockReturnValue(vi.fn())
    window.electronAPI.onPowerResume = resumeMock.mockReturnValue(vi.fn())

    renderHook(() => useReminders())

    expect(suspendMock).toHaveBeenCalled()
    expect(resumeMock).toHaveBeenCalled()
  })
})
