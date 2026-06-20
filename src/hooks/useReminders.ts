import { useEffect, useRef } from 'react'
import { useAppStore, type Note } from '../store/useAppStore'
import { SETTINGS_KEYS } from '../lib/settingsKeys'

function parseReminders(content: string, noteId: string) {
  const reminders: { dueAt: Date; label: string; key: string }[] = []
  const reRem =
    /\/(task(?:-done)?)(?:\s+\((\d{4}-\d{2}-\d{2} \d{2}:\d{2})\))?\s+(.*?)(?:\s+@\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?))?[ \t]*$/gm

  let match
  while ((match = reRem.exec(content)) !== null) {
    const isDone = match[1] === 'task-done'
    const label = match[3]
    const targetStr = match[4]
    if (!isDone && targetStr) {
      const targetMs = new Date(targetStr).getTime()
      if (!isNaN(targetMs)) {
        reminders.push({
          dueAt: new Date(targetMs),
          label,
          key: `${noteId}-${targetMs}-${label}`,
        })
      }
    }
  }
  return reminders
}

function handleDueReminders(notes: Note[]) {
  const now = Date.now()
  const notifiedStr = localStorage.getItem(SETTINGS_KEYS.NOTIFIED_REMINDERS) || '[]'
  const notified = new Set<string>(JSON.parse(notifiedStr))
  let hasNewNotifs = false

  const allReminders = notes.flatMap((n) => parseReminders(n.content, n.id))

  for (const r of allReminders) {
    if (now >= r.dueAt.getTime()) {
      if (!notified.has(r.key)) {
        console.log('Triggering OS notification for:', r.label)
        new Notification('PaperCache Reminder', {
          body: r.label,
          silent: false,
        })
        notified.add(r.key)
        hasNewNotifs = true
      }
    }
  }

  if (hasNewNotifs) {
    localStorage.setItem(SETTINGS_KEYS.NOTIFIED_REMINDERS, JSON.stringify(Array.from(notified)))
  }
}

function scheduleNextReminder(notes: Note[], callback: () => void) {
  const now = Date.now()
  const next = notes
    .flatMap((n) => parseReminders(n.content, n.id))
    .map((r) => r.dueAt.getTime())
    .filter((t) => t > now)
    .sort()[0]

  if (!next) return null

  // Ensure delay is at least 1000ms to avoid tight loops if something goes wrong
  const delay = Math.max(next - now, 1000)
  return setTimeout(callback, delay)
}

export function useReminders() {
  const notes = useAppStore((state) => state.notes)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }

    const checkAndSchedule = () => {
      handleDueReminders(notes)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = scheduleNextReminder(notes, checkAndSchedule)
    }

    checkAndSchedule()

    const onSuspend = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const onResume = () => {
      checkAndSchedule()
    }

    const unsubscribeSuspend = window.electronAPI.onPowerSuspend(onSuspend)
    const unsubscribeResume = window.electronAPI.onPowerResume(onResume)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      unsubscribeSuspend()
      unsubscribeResume()
    }
  }, [notes])
}
