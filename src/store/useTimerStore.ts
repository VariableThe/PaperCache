/**
 * Timer Store
 *
 * Manages active countdown timers. Timer scheduling (sleeping until completion and
 * triggering native OS notifications) is delegated to the Rust backend.
 * The frontend store is responsible only for UI state (countdown display, completion status).
 */

import { create } from 'zustand'

export type TimerStatus = 'running' | 'paused' | 'completed'

export interface Timer {
  id: string
  label: string
  /** Total duration in milliseconds */
  durationMs: number
  /** Remaining milliseconds (updated by the countdown loop) */
  remainingMs: number
  /** Unix timestamp (ms) at which the timer will fire */
  endsAt: number
  status: TimerStatus
}

interface TimerState {
  timers: Timer[]
  addTimer: (label: string, durationMs: number) => string
  removeTimer: (id: string) => void
  tickTimer: (id: string) => void
  completeTimer: (id: string) => void
  pauseTimer: (id: string) => void
  resumeTimer: (id: string) => void
  cleanExpiredTimers: () => void
}

export const useTimerStore = create<TimerState>((set) => ({
  timers: [],

  cleanExpiredTimers: () => {
    const now = Date.now()
    set((state) => ({
      timers: state.timers.filter((t) => t.status !== 'completed' || now - t.endsAt < 10000),
    }))
  },

  addTimer: (label, durationMs) => {
    const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const endsAt = Date.now() + durationMs
    set((state) => ({
      timers: [
        ...state.timers,
        { id, label, durationMs, remainingMs: durationMs, endsAt, status: 'running' },
      ],
    }))
    return id
  },

  removeTimer: (id) => {
    set((state) => ({ timers: state.timers.filter((t) => t.id !== id) }))
  },

  tickTimer: (id) => {
    const timer = useTimerStore.getState().timers.find((t) => t.id === id)
    if (!timer || timer.status !== 'running') return
    const remaining = Math.max(0, timer.endsAt - Date.now())
    if (remaining === 0) {
      useTimerStore.getState().completeTimer(id)
    } else {
      set((state) => ({
        timers: state.timers.map((t) => (t.id === id ? { ...t, remainingMs: remaining } : t)),
      }))
    }
  },

  completeTimer: (id) => {
    const existing = useTimerStore.getState().timers.find((t) => t.id === id)
    if (!existing || existing.status === 'completed') return

    set((state) => ({
      timers: state.timers.map((t) =>
        t.id === id ? { ...t, remainingMs: 0, status: 'completed' } : t
      ),
    }))
    setTimeout(() => {
      useTimerStore.getState().removeTimer(id)
    }, 5000)
  },

  pauseTimer: (id) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.id === id && t.status === 'running' ? { ...t, status: 'paused' } : t
      ),
    }))
  },

  resumeTimer: () => {
    // Backend does not support pause/resume yet; resume action is gated in the UI
  },
}))
