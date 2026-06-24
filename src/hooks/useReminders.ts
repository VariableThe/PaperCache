import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useAppStore, type Note } from '../store/useAppStore'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { parseAllTasks } from '../lib/taskUtils'
import type { ReminderPayload } from '../types'

// Monotonically increasing token to prevent stale scheduleReminders calls
let scheduleToken = 0

function parseReminders(content: string, noteId: string): ReminderPayload[] {
  const reminders: ReminderPayload[] = []
  const tasks = parseAllTasks(content)

  for (const task of tasks) {
    if (!task.isDone && task.targetStr) {
      const targetMs = new Date(task.targetStr).getTime()
      if (!isNaN(targetMs)) {
        reminders.push({
          dueAt: targetMs,
          label: task.label,
          key: `${noteId}-${targetMs}-${task.label}`,
        })
      }
    }
  }
  return reminders
}

function collectFutureReminders(notes: Note[]): ReminderPayload[] {
  const notifiedStr = localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS) || '[]'
  const notified = new Set<string>(JSON.parse(notifiedStr))
  const now = Date.now()

  return notes
    .flatMap((n) => parseReminders(n.content, n.id))
    .filter((r) => r.dueAt > now && !notified.has(r.key))
}

export function useReminders() {
  const notes = useAppStore((state) => state.notes)
  const prevNotesRef = useRef<Note[]>([])

  // Schedule reminders with a monotonic token to prevent stale overwrites
  useEffect(() => {
    prevNotesRef.current = notes
    const pending = collectFutureReminders(notes)
    const token = ++scheduleToken

    window.electronAPI
      .scheduleReminders(pending)
      .then(() => {
        // Only advance prevNotesRef if we're still the latest call
        if (token !== scheduleToken) return
      })
      // eslint-disable-next-line no-console
      .catch((e) => console.error('Failed to schedule reminders', e))
  }, [notes])

  // Listen for the native "reminder-fired" event from the backend
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false

    listen<string>('reminder-fired', (event) => {
      const key = event.payload
      const notifiedStr = localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS) || '[]'
      const notified = new Set<string>(JSON.parse(notifiedStr))
      notified.add(key)
      localStorage.setItem(SETTINGS_KEYS.NOTIFIED_REMINDERS, JSON.stringify(Array.from(notified)))

      const currentNotes = useAppStore.getState().notes
      const allReminders = currentNotes.flatMap((n) => parseReminders(n.content, n.id))
      const reminder = allReminders.find((r) => r.key === key)
      if (reminder) {
        useAppStore.getState().addToast({
          message: `🔔 Reminder: ${reminder.label}`,
          type: 'info',
        })
      }
    }).then((fn) => {
      if (disposed) {
        fn()
        return
      }
      unlisten = fn
    })

    return () => {
      disposed = true
      unlisten?.()
      window.electronAPI.cancelReminders().catch(() => {})
    }
  }, [])
}
