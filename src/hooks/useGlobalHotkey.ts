import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function useGlobalHotkey() {
  const setShowMainActionMenu = useAppStore((state) => state.setShowMainActionMenu)
  const setShowNoteSearch = useAppStore((state) => state.setShowNoteSearch)
  const setShowGraphView = useAppStore((state) => state.setShowGraphView)
  const setShowRemindersView = useAppStore((state) => state.setShowRemindersView)
  const setNotes = useAppStore((state) => state.setNotes)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)
  const setNoteSearchQuery = useAppStore((state) => state.setNoteSearchQuery)
  const setSearchSelectedIndex = useAppStore((state) => state.setSearchSelectedIndex)
  const isHyprland = useAppStore((state) => state.isHyprland)

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const state = useAppStore.getState()
      const isMod = isHyprland ? e.altKey : e.metaKey || e.ctrlKey

      if (e.key === 'Escape') {
        const isRenaming = useAppStore.getState().isRenaming
        const actionMenuIndex = useAppStore.getState().actionMenuIndex
        const isRecordingShortcut = useAppStore.getState().isRecordingShortcut

        if (isRecordingShortcut) return // Do not close app while recording shortcut

        // Dismiss overlays in priority order — highest-level first
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

      // Settings Shortcut
      if (e.key.toLowerCase() === 's' && e.shiftKey && isMod) {
        e.preventDefault()
        useAppStore.getState().setShowSettingsModal(true)
      }

      // Graph View Shortcut
      if (e.key.toLowerCase() === 'g' && isMod) {
        e.preventDefault()
        e.stopPropagation()
        setShowGraphView((prev) => !prev)
      }

      if (e.key === 'n' && isMod) {
        e.preventDefault()
        const id = Date.now() + '.md'
        const newNote = { id, content: '', mtime: Date.now() }
        setNotes((prev) => [newNote, ...prev])
        setCurrentNoteIndex(0)
        window.electronAPI.saveNote(id, '')
      }

      if (e.key === 'e' && isMod) {
        e.preventDefault()
        e.stopPropagation()
        const { notes, currentNoteIndex } = useAppStore.getState()
        const note = notes[currentNoteIndex]
        if (note) {
          const filename = note.id.replace(/\.md$/, '')
          window.electronAPI.exportNote(filename, note.content)
        }
      }

      if (e.key.toLowerCase() === 'p' && isMod) {
        e.preventDefault()
        e.stopPropagation()
        setShowNoteSearch(true)
        setNoteSearchQuery('')
        setSearchSelectedIndex(0)
      }

      if (e.key.toLowerCase() === 't' && isMod) {
        e.preventDefault()
        e.stopPropagation()
        setShowRemindersView(true)
      }

      if (e.key.toLowerCase() === 'k' && isMod) {
        e.preventDefault()
        e.stopPropagation()
        setShowMainActionMenu((prev) => !prev)
      }

      // Shortcuts reference
      if ((e.key === '/' || e.key === '?') && isMod) {
        e.preventDefault()
        e.stopPropagation()
        const { notes } = useAppStore.getState()
        const existingIndex = notes.findIndex((n) => n.id === 'Shortcuts.md')
        if (existingIndex !== -1) {
          setCurrentNoteIndex(existingIndex)
        } else {
          const shortcutsContent = `# Shortcuts

- \`Cmd+Shift+C\` — Toggle visibility (global, configurable)
- \`Cmd+Shift+N\` — New note (global, configurable)
- \`Cmd+Shift+S\` — Open settings
- \`Cmd+N\` — New note
- \`Cmd+T\` — Tasks / Reminders
- \`Cmd+K\` — Main action menu
- \`Cmd+P\` — Search notes
- \`Cmd+G\` — Graph view
- \`Cmd+F\` — Search in graph
- \`Cmd+E\` — Export note
- \`Cmd+/\` — Show this shortcuts reference
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
      }
    }

    // Sync global shortcut on load
    const defaultMod = isHyprland ? 'Alt' : 'CommandOrControl'
    const shortcut = localStorage.getItem('papercache-shortcut-newnote') || `${defaultMod}+Shift+N`
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', '', shortcut)
    }
    const toggleShortcut =
      localStorage.getItem('papercache-shortcut-toggle') || `${defaultMod}+Shift+C`
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
    setNotes,
    setCurrentNoteIndex,
    isHyprland,
  ])
}
