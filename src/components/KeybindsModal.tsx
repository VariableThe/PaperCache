import { useState, useEffect } from 'react'
import { SETTINGS_KEYS, getShortcut } from '../lib/settingsKeys'
import { useAppStore } from '../store/useAppStore'
import { ShortcutInput } from './ShortcutInput'

interface KeybindsModalProps {
  onClose: () => void
}

interface ShortcutConfig {
  key: string
  label: string
  storageKey: string
  defaultKey: string
  section: 'global' | 'app'
  action?: string
  oldShortcutStorageKey?: string
}

export function KeybindsModal({ onClose }: KeybindsModalProps) {
  const isHyprland = useAppStore((state) => state.isHyprland)
  const defaultMod = isHyprland ? 'Alt' : 'CommandOrControl'

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'shortcutToggle',
      label: 'Toggle App Visibility',
      storageKey: SETTINGS_KEYS.SHORTCUT_TOGGLE,
      defaultKey: `${defaultMod}+Shift+C`,
      section: 'global',
      action: 'toggle',
      oldShortcutStorageKey: 'papercache-shortcut-toggle',
    },
    {
      key: 'shortcutNewNote',
      label: 'New Note (Global)',
      storageKey: SETTINGS_KEYS.SHORTCUT_NEWNOTE,
      defaultKey: `${defaultMod}+Shift+N`,
      section: 'global',
      action: 'new-note',
      oldShortcutStorageKey: 'papercache-shortcut-newnote',
    },
    {
      key: 'shortcutTasks',
      label: 'Open Reminders / Tasks',
      storageKey: SETTINGS_KEYS.SHORTCUT_TASKS,
      defaultKey: `${defaultMod}+R`,
      section: 'app',
    },
    {
      key: 'shortcutTimers',
      label: 'Open Timers Panel',
      storageKey: SETTINGS_KEYS.SHORTCUT_TIMERS,
      defaultKey: `${defaultMod}+T`,
      section: 'app',
    },
    {
      key: 'shortcutNewNoteInApp',
      label: 'New Note (In-App)',
      storageKey: SETTINGS_KEYS.SHORTCUT_NEWNOTE_INAPP,
      defaultKey: `${defaultMod}+N`,
      section: 'app',
    },
    {
      key: 'shortcutVoiceMemo',
      label: 'Hold to Record Voice Memo',
      storageKey: SETTINGS_KEYS.SHORTCUT_VOICE_MEMO,
      defaultKey: `${defaultMod}+Shift+M`,
      section: 'app',
    },
    {
      key: 'shortcutSearch',
      label: 'Search Notes',
      storageKey: SETTINGS_KEYS.SHORTCUT_SEARCH,
      defaultKey: `${defaultMod}+P`,
      section: 'app',
    },
    {
      key: 'shortcutGraph',
      label: 'Graph View',
      storageKey: SETTINGS_KEYS.SHORTCUT_GRAPH,
      defaultKey: `${defaultMod}+G`,
      section: 'app',
    },
    {
      key: 'shortcutActionMenu',
      label: 'Main Action Menu',
      storageKey: SETTINGS_KEYS.SHORTCUT_ACTION_MENU,
      defaultKey: `${defaultMod}+K`,
      section: 'app',
    },
    {
      key: 'shortcutExport',
      label: 'Export Note',
      storageKey: SETTINGS_KEYS.SHORTCUT_EXPORT,
      defaultKey: `${defaultMod}+E`,
      section: 'app',
    },
    {
      key: 'shortcutSettings',
      label: 'Open Settings',
      storageKey: SETTINGS_KEYS.SHORTCUT_SETTINGS,
      defaultKey: `${defaultMod}+Shift+S`,
      section: 'app',
    },
    {
      key: 'shortcutRef',
      label: 'Shortcuts Reference',
      storageKey: SETTINGS_KEYS.SHORTCUT_REF,
      defaultKey: `${defaultMod}+/`,
      section: 'app',
    },
  ]

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const sc of shortcuts) {
      initial[sc.key] = getShortcut(sc.storageKey, sc.defaultKey)
    }
    return initial
  })

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
    for (const sc of shortcuts) {
      if (sc.section === 'global' && sc.action && sc.oldShortcutStorageKey) {
        const oldShortcut = localStorage.getItem(sc.oldShortcutStorageKey) || sc.defaultKey
        if (window.electronAPI.updateGlobalShortcut) {
          window.electronAPI.updateGlobalShortcut(sc.action, oldShortcut, values[sc.key]!)
        }
        localStorage.setItem(sc.oldShortcutStorageKey, values[sc.key]!)
      }
      localStorage.setItem(sc.storageKey, values[sc.key]!)
    }

    useAppStore
      .getState()
      .addToast({ message: '⌨️ Keybindings updated successfully', type: 'success' })
    onClose()
  }

  const handleResetDefaults = () => {
    const reset: Record<string, string> = {}
    for (const sc of shortcuts) {
      reset[sc.key] = sc.defaultKey
    }
    setValues(reset)
  }

  const globalShortcuts = shortcuts.filter((s) => s.section === 'global')
  const appShortcuts = shortcuts.filter((s) => s.section === 'app')

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
          {globalShortcuts.map((sc) => (
            <KeybindRow
              key={sc.key}
              label={sc.label}
              value={values[sc.key]!}
              onChange={(val) => setValues((prev) => ({ ...prev, [sc.key]: val }))}
            />
          ))}
        </section>

        <section>
          <h3>In-App Navigation & Actions</h3>
          {appShortcuts.map((sc) => (
            <KeybindRow
              key={sc.key}
              label={sc.label}
              value={values[sc.key]!}
              onChange={(val) => setValues((prev) => ({ ...prev, [sc.key]: val }))}
            />
          ))}
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
