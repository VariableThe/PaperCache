import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useAppStore, type Note } from '../store/useAppStore'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { parseAllTasks } from '../lib/taskUtils'
import type { ReminderPayload } from '../types'

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

// This is a cache, not the source of reminders. An unreadable value should
// neither stop scheduling nor be overwritten with a guessed interpretation.
function readNotifiedKeys(): string[] | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS)
    if (raw === null) return []
    const stored: unknown = JSON.parse(raw)
    if (!Array.isArray(stored) || !stored.every((key) => typeof key === 'string')) return undefined
    return stored
  } catch {
    return undefined
  }
}

function collectFutureReminders(notes: Note[], notified: ReadonlySet<string>): ReminderPayload[] {
  const now = Date.now()

  return notes
    .flatMap((n) => parseReminders(n.content, n.id))
    .filter((r) => r.dueAt > now && !notified.has(r.key))
}

export function useReminders() {
  const notes = useAppStore((state) => state.notes)
  const notifiedThisSession = useRef(new Set<string>())

  useEffect(() => {
    const token = ++scheduleToken
    const notified = notifiedThisSession.current
    readNotifiedKeys()?.forEach((key) => notified.add(key))
    const pending = collectFutureReminders(notes, notified)
    if (token !== scheduleToken) return

    window.electronAPI
      .scheduleReminders(pending)
      .then(() => {})
      // eslint-disable-next-line no-console
      .catch((e) => console.error('Failed to schedule reminders', e))
  }, [notes])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false

    listen<string>('reminder-fired', (event) => {
      if (disposed) return

      const key = event.payload
      const saved = readNotifiedKeys()
      const notified = notifiedThisSession.current
      saved?.forEach((stored) => notified.add(stored))
      if (notified.has(key)) return
      notified.add(key)
      if (saved !== undefined) {
        try {
          localStorage.setItem(SETTINGS_KEYS.NOTIFIED_REMINDERS, JSON.stringify([...notified]))
        } catch {
          // Permission or quota failure must not suppress the reminder toast.
          // The in-memory set still prevents repeats until the app is closed.
        }
      }

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
