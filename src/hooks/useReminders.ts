import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useReminders() {
  const notes = useAppStore((state) => state.notes)

  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }

    const interval = setInterval(() => {
      const notifiedStr = localStorage.getItem('papercache_notified') || '[]'
      const notified = new Set<string>(JSON.parse(notifiedStr))
      let hasNewNotifs = false

      notes.forEach((note) => {
        const reRem =
          /\/(task(?:-done)?)(?:\s+\((\d{4}-\d{2}-\d{2} \d{2}:\d{2})\))?\s+(.*?)(?:\s+@\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?))?[ \t]*$/gm
        let match
        while ((match = reRem.exec(note.content)) !== null) {
          const isDone = match[1] === 'task-done'
          const label = match[3]
          const targetStr = match[4]
          if (!isDone && targetStr) {
            const targetMs = new Date(targetStr).getTime()
            if (Date.now() >= targetMs) {
              const notifKey = `${note.id}-${targetMs}-${label}`
              if (!notified.has(notifKey)) {
                console.log('Triggering OS notification for:', label)
                new Notification('PaperCache Reminder', {
                  body: label,
                  silent: false,
                })
                notified.add(notifKey)
                hasNewNotifs = true
              }
            }
          }
        }
      })

      if (hasNewNotifs) {
        localStorage.setItem('papercache_notified', JSON.stringify(Array.from(notified)))
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [notes])
}
