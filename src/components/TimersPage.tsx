/**
 * TimersPage – Active countdown timer management panel.
 *
 * Countdown accuracy: Uses a chained setTimeout pattern (instead of setInterval)
 * to comply with the "no setInterval" rule. Each tick schedules the next tick
 * dynamically, so drift correction is automatic.
 *
 * Background operation: The actual completion event is triggered by the Rust backend
 * (tokio::time::sleep), so the timer fires even if the app is minimized.
 * The frontend display is best-effort and syncs to the backend-derived endsAt timestamp.
 */

import { useState, useEffect, useRef } from 'react'
import { useTimerStore, type Timer } from '../store/useTimerStore'
interface TimerItemProps {
  timer: Timer
  onRemove: (id: string) => void
}

function formatTime(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSecs = Math.ceil(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function TimerItem({ timer, onRemove }: TimerItemProps) {
  const tickTimer = useTimerStore((s) => s.tickTimer)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Chained setTimeout countdown loop — only runs when timer is "running"
  useEffect(() => {
    if (timer.status !== 'running') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return undefined
    }

    const tick = () => {
      tickTimer(timer.id)
      const remaining = Math.max(0, timer.endsAt - Date.now())
      if (remaining > 0) {
        // Schedule next tick in ~250ms for smooth display
        timeoutRef.current = setTimeout(tick, 250)
      }
    }

    timeoutRef.current = setTimeout(tick, 250)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [timer.id, timer.status, timer.endsAt, tickTimer])

  const progress =
    timer.durationMs > 0 ? Math.max(0, Math.min(1, timer.remainingMs / timer.durationMs)) : 0

  const isCompleted = timer.status === 'completed'
  const isPaused = timer.status === 'paused'

  return (
    <div
      className={`timer-item ${isCompleted ? 'timer-completed' : ''} ${isPaused ? 'timer-paused' : ''}`}
    >
      <div className="timer-header">
        <span className="timer-label">{timer.label || 'Timer'}</span>
        <div className="timer-controls">
          <button
            className="timer-btn timer-btn-remove"
            onClick={() => onRemove(timer.id)}
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      <div className="timer-countdown">
        {isCompleted ? '✓ Done' : formatTime(timer.remainingMs)}
      </div>

      <div className="timer-progress-track">
        <div
          className={`timer-progress-fill ${isCompleted ? 'timer-progress-done' : ''}`}
          style={{ width: `${(isCompleted ? 0 : progress) * 100}%` }}
        />
      </div>
    </div>
  )
}

interface TimersPageProps {
  onClose: () => void
}

const QUICK_PRESETS = [
  { label: '5 min', ms: 5 * 60 * 1000 },
  { label: '10 min', ms: 10 * 60 * 1000 },
  { label: '25 min', ms: 25 * 60 * 1000 },
  { label: '1 hr', ms: 60 * 60 * 1000 },
]

export function TimersPage({ onClose }: TimersPageProps) {
  const timers = useTimerStore((s) => s.timers)
  const addTimer = useTimerStore((s) => s.addTimer)
  const removeTimer = useTimerStore((s) => s.removeTimer)

  const [labelInput, setLabelInput] = useState('')
  const [hInput, setHInput] = useState('0')
  const [mInput, setMInput] = useState('25')
  const [sInput, setSInput] = useState('0')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCreate = async () => {
    const h = parseInt(hInput) || 0
    const m = parseInt(mInput) || 0
    const s = parseInt(sInput) || 0
    const durationMs = (h * 3600 + m * 60 + s) * 1000
    if (durationMs <= 0) return

    const label =
      labelInput.trim() ||
      `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s > 0 ? `${s}s` : ''}`.trim()
    const id = addTimer(label, durationMs)
    try {
      await window.electronAPI.scheduleTimer(id, durationMs, label)
      setLabelInput('')
    } catch {
      removeTimer(id)
    }
  }

  const handleRemove = (id: string) => {
    window.electronAPI.cancelTimer(id).catch(() => {})
    removeTimer(id)
  }

  const handlePreset = async (ms: number, presetLabel: string) => {
    const id = addTimer(presetLabel, ms)
    try {
      await window.electronAPI.scheduleTimer(id, ms, presetLabel)
    } catch {
      removeTimer(id)
    }
  }

  return (
    <div className="timers-overlay" onClick={onClose}>
      <div className="timers-panel" onClick={(e) => e.stopPropagation()}>
        <div className="timers-header">
          <h2 style={{ margin: 0, color: 'var(--text-color)', fontWeight: 700, fontSize: 17 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                marginRight: 7,
                marginBottom: 2,
              }}
            >
              <circle cx="12" cy="13" r="8" />
              <polyline points="12 9 12 13 14.5 15.5" />
              <line x1="9.5" y1="2" x2="14.5" y2="2" />
              <line x1="12" y1="2" x2="12" y2="5" />
            </svg>
            Timers
          </h2>
          <button className="timers-close-btn" onClick={onClose}>
            Close (Esc)
          </button>
        </div>

        {/* Create new timer */}
        <div className="timer-create-section">
          <input
            className="timer-label-input"
            placeholder="Timer label (optional)"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="timer-duration-row">
            <div className="timer-duration-field">
              <input
                type="number"
                min="0"
                value={hInput}
                onChange={(e) => setHInput(e.target.value)}
              />
              <span>h</span>
            </div>
            <div className="timer-duration-field">
              <input
                type="number"
                min="0"
                max="59"
                value={mInput}
                onChange={(e) => setMInput(e.target.value)}
              />
              <span>m</span>
            </div>
            <div className="timer-duration-field">
              <input
                type="number"
                min="0"
                max="59"
                value={sInput}
                onChange={(e) => setSInput(e.target.value)}
              />
              <span>s</span>
            </div>
            <button className="timer-start-btn" onClick={handleCreate}>
              Start
            </button>
          </div>
          <div className="timer-presets">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.label}
                className="timer-preset-btn"
                onClick={() => handlePreset(p.ms, p.label)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active timers list */}
        <div className="timers-list">
          {timers.length === 0 ? (
            <div className="timers-empty">
              <div className="timers-empty-icon">⏱</div>
              <p>No active timers</p>
              <p className="timers-empty-hint">
                Use <code>/timer</code> in any note or create one above.
              </p>
            </div>
          ) : (
            timers.map((t) => <TimerItem key={t.id} timer={t} onRemove={handleRemove} />)
          )}
        </div>
      </div>
    </div>
  )
}
