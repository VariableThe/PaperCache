import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SETTINGS_KEYS, getShortcut } from '../lib/settingsKeys'
import { getCurrentWindow } from '@tauri-apps/api/window'

function matchShortcut(e: KeyboardEvent, configuredStr: string): boolean {
  if (!configuredStr) return false
  const parts = configuredStr.split('+')
  const expectedKey = parts[parts.length - 1]

  const expectCmdOrCtrl = parts.includes('CommandOrControl') || parts.includes('Command')
  const expectAlt = parts.includes('Alt') || parts.includes('Option')
  const expectShift = parts.includes('Shift')
  const expectCtrl = parts.includes('Control')

  const hasCmdOrCtrl = e.metaKey || e.ctrlKey
  const hasAlt = e.altKey
  const hasShift = e.shiftKey

  if (expectCmdOrCtrl !== hasCmdOrCtrl) return false
  if (expectAlt !== hasAlt) return false
  if (expectShift !== hasShift) return false
  if (expectCtrl && !e.ctrlKey) return false

  let key = e.key.toUpperCase()
  if (key === ' ') key = 'Space'
  if (key === 'ARROWUP') key = 'Up'
  if (key === 'ARROWDOWN') key = 'Down'
  if (key === 'ARROWLEFT') key = 'Left'
  if (key === 'ARROWRIGHT') key = 'Right'

  return key === expectedKey
}

export function useGlobalHotkey() {
  const setShowMainActionMenu = useAppStore((state) => state.setShowMainActionMenu)
  const setShowNoteSearch = useAppStore((state) => state.setShowNoteSearch)
  const setShowGraphView = useAppStore((state) => state.setShowGraphView)
  const setShowRemindersView = useAppStore((state) => state.setShowRemindersView)
  const setShowTimersView = useAppStore((state) => state.setShowTimersView)
  const setNotes = useAppStore((state) => state.setNotes)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)
  const setNoteSearchQuery = useAppStore((state) => state.setNoteSearchQuery)
  const setSearchSelectedIndex = useAppStore((state) => state.setSearchSelectedIndex)
  const isHyprland = useAppStore((state) => state.isHyprland)

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const state = useAppStore.getState()
      if (state.isRecordingShortcut) return
      const defaultMod = isHyprland ? 'Alt' : 'CommandOrControl'

      if (e.key === 'Escape') {
        const isRenaming = useAppStore.getState().isRenaming
        const actionMenuIndex = useAppStore.getState().actionMenuIndex
        const isRecordingShortcut = useAppStore.getState().isRecordingShortcut

        if (isRecordingShortcut) return // Do not close app while recording shortcut

        // Dismiss overlays in priority order — highest-level first
        if (state.showKeybindsModal || state.showSettingsModal) {
          return // Let their own ESC handlers close them
        }
        if (state.showMainActionMenu) {
          e.preventDefault()
          e.stopPropagation()
          setShowMainActionMenu(false)
          return
        }
        if (state.showNoteSearch) {
          e.preventDefault()
          e.stopPropagation()
          setShowNoteSearch(false)
          return
        }
        if (state.showGraphView) {
          e.preventDefault()
          e.stopPropagation()
          setShowGraphView(false)
          return
        }
        // Timers and Reminders pages have their own ESC handlers — let them fire
        if (state.showTimersView || state.showRemindersView) {
          return
        }

        // Nothing was open: hide the window
        if (!isRenaming && actionMenuIndex === 0) {
          await getCurrentWindow().hide()
        }
      }

      // Read current configured shortcuts or defaults
      const scSettings = getShortcut(SETTINGS_KEYS.SHORTCUT_SETTINGS, `${defaultMod}+Shift+S`)
      const scGraph = getShortcut(SETTINGS_KEYS.SHORTCUT_GRAPH, `${defaultMod}+G`)
      const scNewNoteInApp = getShortcut(SETTINGS_KEYS.SHORTCUT_NEWNOTE_INAPP, `${defaultMod}+N`)
      const scExport = getShortcut(SETTINGS_KEYS.SHORTCUT_EXPORT, `${defaultMod}+E`)
      const scSearch = getShortcut(SETTINGS_KEYS.SHORTCUT_SEARCH, `${defaultMod}+P`)
      const scTasks = getShortcut(SETTINGS_KEYS.SHORTCUT_TASKS, `${defaultMod}+R`)
      const scTimers = getShortcut(SETTINGS_KEYS.SHORTCUT_TIMERS, `${defaultMod}+T`)
      const scActionMenu = getShortcut(SETTINGS_KEYS.SHORTCUT_ACTION_MENU, `${defaultMod}+K`)
      const scRef = getShortcut(SETTINGS_KEYS.SHORTCUT_REF, `${defaultMod}+/`)
      const scToggle = getShortcut(SETTINGS_KEYS.SHORTCUT_TOGGLE, `${defaultMod}+Shift+C`)
      const scNewNote = getShortcut(SETTINGS_KEYS.SHORTCUT_NEWNOTE, `${defaultMod}+Shift+N`)

      // Settings Shortcut
      if (matchShortcut(e, scSettings)) {
        e.preventDefault()
        useAppStore.getState().setShowSettingsModal(true)
        return
      }

      // Graph View Shortcut
      if (matchShortcut(e, scGraph)) {
        e.preventDefault()
        e.stopPropagation()
        setShowGraphView((prev) => !prev)
        return
      }

      // New Note In-App Shortcut
      if (matchShortcut(e, scNewNoteInApp)) {
        e.preventDefault()
        const id = Date.now() + '.md'
        const newNote = { id, content: '', mtime: Date.now() }
        setNotes((prev) => [newNote, ...prev])
        setCurrentNoteIndex(0)
        window.electronAPI.saveNote(id, '')
        return
      }

      // Export Note Shortcut
      if (matchShortcut(e, scExport)) {
        e.preventDefault()
        e.stopPropagation()
        const { notes, currentNoteIndex } = useAppStore.getState()
        const note = notes[currentNoteIndex]
        if (note) {
          const filename = note.id.replace(/\.md$/, '')
          window.electronAPI.exportNote(filename, note.content)
        }
        return
      }

      // Search Notes Shortcut
      if (matchShortcut(e, scSearch)) {
        e.preventDefault()
        e.stopPropagation()
        setShowNoteSearch(true)
        setNoteSearchQuery('')
        setSearchSelectedIndex(0)
        return
      }

      // Tasks / Reminders Shortcut (Cmd+R by default)
      if (matchShortcut(e, scTasks)) {
        e.preventDefault()
        e.stopPropagation()
        setShowRemindersView(true)
        return
      }

      // Timers Panel Shortcut (Cmd+T by default)
      if (matchShortcut(e, scTimers)) {
        e.preventDefault()
        e.stopPropagation()
        setShowTimersView(true)
        return
      }

      // Action Menu Shortcut
      if (matchShortcut(e, scActionMenu)) {
        e.preventDefault()
        e.stopPropagation()
        setShowMainActionMenu((prev) => !prev)
        return
      }

      // Shortcuts reference
      if (matchShortcut(e, scRef) || (e.key === '?' && (e.metaKey || e.ctrlKey || e.altKey))) {
        e.preventDefault()
        e.stopPropagation()
        const { notes } = useAppStore.getState()
        const existingIndex = notes.findIndex((n) => n.id === 'Shortcuts.md')
        if (existingIndex !== -1) {
          setCurrentNoteIndex(existingIndex)
        } else {
          const fmt = (sc: string) =>
            sc
              .replace(/CommandOrControl/g, isHyprland ? 'Alt' : 'Cmd')
              .replace(/Command/g, 'Cmd')
              .replace(/Control/g, 'Ctrl')

          const shortcutsContent = `# Shortcuts

- \`${fmt(scToggle)}\` — Toggle visibility (global, configurable)
- \`${fmt(scNewNote)}\` — New note (global, configurable)
- \`${fmt(scSettings)}\` — Open settings
- \`${fmt(scNewNoteInApp)}\` — New note
- \`${fmt(scTasks)}\` — Tasks / Reminders
- \`${fmt(scTimers)}\` — Timers Panel
- \`${fmt(scActionMenu)}\` — Main action menu
- \`${fmt(scSearch)}\` — Search notes
- \`${fmt(scGraph)}\` — Graph view
- \`Cmd+F\` — Search in graph
- \`${fmt(scExport)}\` — Export note
- \`${fmt(scRef)}\` — Show this shortcuts reference
- \`Esc\` — Close menus / modals

### Slash Commands
Type \`/\` in the editor for inline suggestions:
- \`/ai\` — AI prompt
- \`/check\` — Checkbox
- \`/task\` — Task with due date
- \`/timer\` — Countdown timer
- \`/var\` — Local variable
- \`/globvar\` — Global variable
- \`/ctx\` — Context note
`
          const newNote = { id: 'Shortcuts.md', content: shortcutsContent, mtime: Date.now() }
          setNotes((prev) => [newNote, ...prev])
          setCurrentNoteIndex(0)
          window.electronAPI.saveNote('Shortcuts.md', shortcutsContent)
        }
        return
      }
    }

    // Sync global shortcut on load
    const defaultMod = isHyprland ? 'Alt' : 'CommandOrControl'
    const shortcut = getShortcut(SETTINGS_KEYS.SHORTCUT_NEWNOTE, `${defaultMod}+Shift+N`)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', '', shortcut)
    }
    const toggleShortcut = getShortcut(SETTINGS_KEYS.SHORTCUT_TOGGLE, `${defaultMod}+Shift+C`)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('toggle', '', toggleShortcut)
    }

    // Listen for global new note shortcut
    let disposeNewNote: (() => void) | undefined
    if (window.electronAPI.onTriggerNewNote) {
      disposeNewNote = window.electronAPI.onTriggerNewNote(() => {
        const id = Date.now() + '.md'
        const initialNote = { id, content: '', mtime: Date.now() }
        setNotes((prev) => [initialNote, ...prev])
        window.electronAPI.saveNote(id, '')
        setCurrentNoteIndex(0)
      })
    }

    let disposeTasks: (() => void) | undefined
    if (window.electronAPI.onTriggerTasks) {
      disposeTasks = window.electronAPI.onTriggerTasks(() => {
        setShowRemindersView((prev) => !prev)
      })
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
      disposeNewNote?.()
      disposeTasks?.()
    }
  }, [
    setShowGraphView,
    setShowMainActionMenu,
    setShowNoteSearch,
    setNoteSearchQuery,
    setSearchSelectedIndex,
    setShowRemindersView,
    setShowTimersView,
    setNotes,
    setCurrentNoteIndex,
    isHyprland,
  ])
}
