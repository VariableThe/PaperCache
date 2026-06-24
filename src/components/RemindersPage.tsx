import React from 'react'
import { parseAllTasks } from '../lib/taskUtils'

interface Note {
  id: string
  content: string
}

interface RemindersPageProps {
  notes: Note[]
  onClose: () => void
  onNavigateToNote: (noteId: string) => void
  onToggleReminder: (noteId: string, from: number, to: number, insert: string) => void
  theme: 'light' | 'dark'
}

interface ReminderItem {
  noteId: string
  label: string
  done: boolean
  targetMs: number | null
  creationDate: string | null
  matchIndex: number
  matchLength: number
}

export const RemindersPage: React.FC<RemindersPageProps> = ({
  notes,
  onClose,
  onNavigateToNote,
  onToggleReminder,
  theme,
}) => {
  const isDark = theme === 'dark'
  const bgColor = isDark ? '#1e1e1e' : '#ffffff'
  const textColor = isDark ? '#d4d4d4' : '#333333'
  const borderColor = isDark ? '#333333' : '#e0e0e0'
  const itemBgHover = isDark ? '#2a2a2a' : '#f5f5f5'

  // Parse reminders from all notes
  const reminders: ReminderItem[] = []

  notes.forEach((note) => {
    const tasks = parseAllTasks(note.content)
    for (const task of tasks) {
      if (task.isDone) continue
      reminders.push({
        noteId: note.id,
        done: task.isDone,
        creationDate: task.creationDate,
        label: task.label,
        targetMs: task.targetStr ? new Date(task.targetStr).getTime() : null,
        matchIndex: task.matchIndex,
        matchLength: task.matchLength,
      })
    }
  })

  // Sort: Overdue first, then soonest, then no target
  reminders.sort((a, b) => {
    if (a.targetMs && b.targetMs) return a.targetMs - b.targetMs
    if (a.targetMs) return -1
    if (b.targetMs) return 1
    return 0
  })

  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let isMounted = true
    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        if (!isMounted) return
        setNow(Date.now())
        scheduleNext()
      }, 10000) // update every 10s for better responsiveness
    }
    scheduleNext()
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: bgColor,
        color: textColor,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '24px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 700, color: textColor }}>Tasks</h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: isDark ? '#999' : '#666',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {reminders.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: isDark ? '#666' : '#999',
              textAlign: 'center',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="48"
              height="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: '16px', opacity: 0.5 }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p style={{ margin: 0, fontSize: '15px' }}>No tasks found.</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.8 }}>
              Type `/task ` in any note to create one.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            {reminders.map((rem, idx) => {
              const isOverdue = !rem.done && rem.targetMs && rem.targetMs < now
              const isImminent =
                !rem.done &&
                rem.targetMs &&
                rem.targetMs > now &&
                rem.targetMs - now < 60 * 60 * 1000

              let baseColor = '#7EB8D4' // default
              if (!rem.done && rem.targetMs) {
                if (isOverdue)
                  baseColor = '#FF3B30' // red
                else if (isImminent) baseColor = '#faad14' // orange
              }

              return (
                <div
                  key={idx}
                  onClick={() => {
                    onNavigateToNote(rem.noteId)
                    onClose()
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = itemBgHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation() // Prevent navigation
                      const from = rem.matchIndex
                      const to = rem.matchIndex + (rem.done ? 10 : 5) // length of /task-done or /task
                      const insert = rem.done ? '/task' : '/task-done'
                      onToggleReminder(rem.noteId, from, to, insert)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      border: `2px solid ${baseColor}`,
                      borderRadius: '50%',
                      backgroundColor: rem.done ? baseColor : 'transparent',
                      color: rem.done ? 'white' : 'transparent',
                      marginRight: '12px',
                      flexShrink: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <circle cx="12" cy="12" r="8"></circle>
                    </svg>
                  </span>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontFamily: 'inherit',
                        fontWeight: 600,
                        color: rem.done
                          ? isDark
                            ? '#666'
                            : '#999'
                          : isOverdue
                            ? '#FF3B30'
                            : textColor,
                        textDecoration: rem.done ? 'line-through' : 'none',
                      }}
                    >
                      {rem.label}
                    </span>

                    {rem.creationDate && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: isDark ? '#777' : '#999',
                          marginTop: '2px',
                          fontFamily: 'inherit',
                          fontWeight: 400,
                        }}
                      >
                        Created {rem.creationDate}
                      </span>
                    )}
                  </div>

                  {rem.targetMs && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: isOverdue ? '#FF3B30' : isDark ? '#999' : '#666',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        fontWeight: 500,
                      }}
                    >
                      {isOverdue ? 'Overdue: ' : 'Due: '}
                      {new Date(rem.targetMs).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default RemindersPage
