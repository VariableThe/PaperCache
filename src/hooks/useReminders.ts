import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useAppStore, type Note } from '../store/useAppStore'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { parseAllTasks } from '../lib/taskUtils'

interface ReminderPayload {
  key: string
  label: string
  dueAt: number // Unix ms
}

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
  // Track the notes reference so we can skip redundant invocations
  const prevNotesRef = useRef<Note[]>([])

  // Schedule reminders in the Rust backend whenever notes change
  useEffect(() => {
    prevNotesRef.current = notes
    const pending = collectFutureReminders(notes)

    window.electronAPI
      .scheduleReminders(pending)
      // eslint-disable-next-line no-console
      .catch((e) => console.error('Failed to schedule reminders', e))
  }, [notes])

  // Listen for the native "reminder-fired" event from the backend
  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen<string>('reminder-fired', (event) => {
      const key = event.payload
      // Mark reminder as notified in localStorage
      const notifiedStr = localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS) || '[]'
      const notified = new Set<string>(JSON.parse(notifiedStr))
      notified.add(key)
      localStorage.setItem(SETTINGS_KEYS.NOTIFIED_REMINDERS, JSON.stringify(Array.from(notified)))

      // Find the label from current notes for the in-app toast
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
      unlisten = fn
    })

    return () => {
      unlisten?.()
      window.electronAPI.cancelReminders().catch(() => {})
    }
  }, [])
}
