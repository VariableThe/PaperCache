import { useState, useEffect } from 'react'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { useAppStore } from '../store/useAppStore'
import { ShortcutInput } from './ShortcutInput'

interface KeybindsModalProps {
  onClose: () => void
}

export function KeybindsModal({ onClose }: KeybindsModalProps) {
  const isHyprland = useAppStore((state) => state.isHyprland)
  const defaultMod = isHyprland ? 'Alt' : 'CommandOrControl'

  // Global Shortcuts
  const [shortcutNewNote, setShortcutNewNote] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_NEWNOTE) || `${defaultMod}+Shift+N`
  )
  const [shortcutToggle, setShortcutToggle] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_TOGGLE) || `${defaultMod}+Shift+C`
  )

  // In-App Shortcuts
  const [shortcutTasks, setShortcutTasks] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_TASKS) || `${defaultMod}+R`
  )
  const [shortcutTimers, setShortcutTimers] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_TIMERS) || `${defaultMod}+T`
  )
  const [shortcutSearch, setShortcutSearch] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_SEARCH) || `${defaultMod}+P`
  )
  const [shortcutGraph, setShortcutGraph] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_GRAPH) || `${defaultMod}+G`
  )
  const [shortcutActionMenu, setShortcutActionMenu] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_ACTION_MENU) || `${defaultMod}+K`
  )
  const [shortcutExport, setShortcutExport] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_EXPORT) || `${defaultMod}+E`
  )
  const [shortcutRef, setShortcutRef] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_REF) || `${defaultMod}+/`
  )
  const [shortcutSettings, setShortcutSettings] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_SETTINGS) || `${defaultMod}+Shift+S`
  )
  const [shortcutNewNoteInApp, setShortcutNewNoteInApp] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_NEWNOTE_INAPP) || `${defaultMod}+N`
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isRecordingShortcut = useAppStore.getState().isRecordingShortcut
      if (e.key === 'Escape' && !e.defaultPrevented && !isRecordingShortcut) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [onClose])

  const handleSave = () => {
    // Save Global Shortcuts
    const oldShortcutNewNote =
      localStorage.getItem('papercache-shortcut-newnote') || `${defaultMod}+Shift+N`
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', oldShortcutNewNote, shortcutNewNote)
    }
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_NEWNOTE, shortcutNewNote)
    localStorage.setItem('papercache-shortcut-newnote', shortcutNewNote)

    const oldShortcutToggle =
      localStorage.getItem('papercache-shortcut-toggle') || `${defaultMod}+Shift+C`
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('toggle', oldShortcutToggle, shortcutToggle)
    }
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_TOGGLE, shortcutToggle)
    localStorage.setItem('papercache-shortcut-toggle', shortcutToggle)

    // Save In-App Shortcuts
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_TASKS, shortcutTasks)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_TIMERS, shortcutTimers)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_SEARCH, shortcutSearch)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_GRAPH, shortcutGraph)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_ACTION_MENU, shortcutActionMenu)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_EXPORT, shortcutExport)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_REF, shortcutRef)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_SETTINGS, shortcutSettings)
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_NEWNOTE_INAPP, shortcutNewNoteInApp)

    useAppStore
      .getState()
      .addToast({ message: '⌨️ Keybindings updated successfully', type: 'success' })
    onClose()
  }

  const handleResetDefaults = () => {
    setShortcutToggle(`${defaultMod}+Shift+C`)
    setShortcutNewNote(`${defaultMod}+Shift+N`)
    setShortcutTasks(`${defaultMod}+R`)
    setShortcutTimers(`${defaultMod}+T`)
    setShortcutSearch(`${defaultMod}+P`)
    setShortcutGraph(`${defaultMod}+G`)
    setShortcutActionMenu(`${defaultMod}+K`)
    setShortcutExport(`${defaultMod}+E`)
    setShortcutRef(`${defaultMod}+/`)
    setShortcutSettings(`${defaultMod}+Shift+S`)
    setShortcutNewNoteInApp(`${defaultMod}+N`)
  }

  return (
    <div
      className="settings-container"
      style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}
    >
      <div className="settings-header">
        <h2>Keybindings Management</h2>
      </div>

      <div className="settings-content">
        <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '24px', textAlign: 'center' }}>
          Click any action button below to record a new key combination. Freedom of control is
          necessary for peak workflow velocity.
        </p>

        <section>
          <h3>Global Shortcuts (OS Level)</h3>
          <KeybindRow
            label="Toggle App Visibility"
            value={shortcutToggle}
            onChange={setShortcutToggle}
          />
          <KeybindRow
            label="New Note (Global)"
            value={shortcutNewNote}
            onChange={setShortcutNewNote}
          />
        </section>

        <section>
          <h3>In-App Navigation & Actions</h3>
          <KeybindRow
            label="Open Reminders / Tasks"
            value={shortcutTasks}
            onChange={setShortcutTasks}
          />
          <KeybindRow
            label="Open Timers Panel"
            value={shortcutTimers}
            onChange={setShortcutTimers}
          />
          <KeybindRow
            label="New Note (In-App)"
            value={shortcutNewNoteInApp}
            onChange={setShortcutNewNoteInApp}
          />
          <KeybindRow label="Search Notes" value={shortcutSearch} onChange={setShortcutSearch} />
          <KeybindRow label="Graph View" value={shortcutGraph} onChange={setShortcutGraph} />
          <KeybindRow
            label="Main Action Menu"
            value={shortcutActionMenu}
            onChange={setShortcutActionMenu}
          />
          <KeybindRow label="Export Note" value={shortcutExport} onChange={setShortcutExport} />
          <KeybindRow
            label="Open Settings"
            value={shortcutSettings}
            onChange={setShortcutSettings}
          />
          <KeybindRow label="Shortcuts Reference" value={shortcutRef} onChange={setShortcutRef} />
        </section>
      </div>

      <div className="settings-footer">
        <button className="close-btn" onClick={handleResetDefaults}>
          Reset Defaults
        </button>
        <button className="close-btn" onClick={onClose}>
          Cancel (Esc)
        </button>
        <button className="save-btn" onClick={handleSave}>
          Save Keybindings
        </button>
      </div>
    </div>
  )
}

function KeybindRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 4px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <span
        style={{
          fontSize: '14px',
          color: '#eee',
          textAlign: 'left',
          flex: 1,
          paddingRight: '16px',
        }}
      >
        {label}
      </span>
      <ShortcutInput value={value} onChange={onChange} />
    </div>
  )
}
