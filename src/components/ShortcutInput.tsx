import React, { useState, useEffect, Fragment } from 'react'
import { useAppStore } from '../store/useAppStore'

export function ShortcutInput({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const [recording, setRecordingLocal] = useState(false)
  const setIsRecordingShortcut = useAppStore((state) => state.setIsRecordingShortcut)

  const setRecording = (val: boolean) => {
    setRecordingLocal(val)
    setIsRecordingShortcut(val)
  }

  useEffect(() => {
    if (recording) {
      if (window.electronAPI.pauseShortcuts) window.electronAPI.pauseShortcuts()
    } else {
      if (window.electronAPI.resumeShortcuts) window.electronAPI.resumeShortcuts()
    }
  }, [recording])

  const renderShortcutDisplay = (shortcut: string) => {
    if (!shortcut)
      return (
        <span style={{ opacity: 0.5, fontSize: '13px', width: '100%', textAlign: 'center' }}>
          Click to record
        </span>
      )
    const parts = shortcut.split('+')
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {parts.map((part, index) => {
          let display = part
          switch (part) {
            case 'CommandOrControl':
            case 'Command':
              display = '⌘'
              break
            case 'Control':
              display = '⌃'
              break
            case 'Shift':
              display = '⇧'
              break
            case 'Alt':
            case 'Option':
              display = '⌥'
              break
            case 'Up':
              display = '↑'
              break
            case 'Down':
              display = '↓'
              break
            case 'Left':
              display = '←'
              break
            case 'Right':
              display = '→'
              break
            case 'Space':
              display = '␣'
              break
          }
          return (
            <Fragment key={index}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '24px',
                  height: '24px',
                  padding: '0 6px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderBottom: '2px solid #52525b',
                  borderRadius: '5px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  flexShrink: 0,
                }}
              >
                {display}
              </span>
              {index < parts.length - 1 && (
                <span
                  style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}
                >
                  +
                </span>
              )}
            </Fragment>
          )
        })}
      </div>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()

    if (e.key === 'Escape') {
      setRecording(false)
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('')
      setRecording(false)
      return
    }

    const modifiers = []
    if (e.metaKey || e.ctrlKey) modifiers.push('CommandOrControl')
    if (e.altKey) modifiers.push('Alt')
    if (e.shiftKey) modifiers.push('Shift')

    // Don't record if only a modifier is pressed
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return
    }

    let key = e.key.toUpperCase()
    if (key === ' ') key = 'Space'
    // Map arrows and other special keys
    if (key === 'ARROWUP') key = 'Up'
    if (key === 'ARROWDOWN') key = 'Down'
    if (key === 'ARROWLEFT') key = 'Left'
    if (key === 'ARROWRIGHT') key = 'Right'

    const shortcut = [...modifiers, key].join('+')
    onChange(shortcut)
    setRecording(false)
  }

  return (
    <button
      className="shortcut-input-btn"
      onClick={(e) => {
        setRecording(true)
        e.currentTarget.focus()
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => setRecording(false)}
      style={{
        padding: '6px 10px',
        background: recording ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.3)',
        border: recording ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        cursor: 'pointer',
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px',
        flexShrink: 0,
        margin: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#ffffff',
        fontFamily: 'inherit',
        fontSize: '13px',
        boxShadow: recording
          ? '0 0 12px rgba(59, 130, 246, 0.3)'
          : 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.15s ease',
      }}
    >
      {recording ? (
        <span style={{ color: '#60a5fa', fontWeight: 500, width: '100%', textAlign: 'center' }}>
          Recording... (Esc)
        </span>
      ) : (
        renderShortcutDisplay(value)
      )}
    </button>
  )
}
