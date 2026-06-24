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
}

export const useTimerStore = create<TimerState>((set) => ({
  timers: [],

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
    set((state) => ({
      timers: state.timers.map((t) => {
        if (t.id !== id || t.status !== 'running') return t
        const remaining = Math.max(0, t.endsAt - Date.now())
        return { ...t, remainingMs: remaining }
      }),
    }))
  },

  completeTimer: (id) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.id === id ? { ...t, remainingMs: 0, status: 'completed' } : t
      ),
    }))
  },

  pauseTimer: (id) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.id === id && t.status === 'running' ? { ...t, status: 'paused' } : t
      ),
    }))
  },

  resumeTimer: (id) => {
    // Backend does not support pause/resume yet; resume via a fresh schedule
    set((state) => ({
      timers: state.timers.map((t) => (t.id === id ? { ...t, status: 'completed' } : t)),
    }))
  },
}))
