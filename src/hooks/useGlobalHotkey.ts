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

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const state = useAppStore.getState()

      if (e.key === 'Escape') {
        const isRenaming = useAppStore.getState().isRenaming
        const actionMenuIndex = useAppStore.getState().actionMenuIndex
        const isRecordingShortcut = useAppStore.getState().isRecordingShortcut

        if (isRecordingShortcut) return // Do not close app while recording shortcut

        // Close the app if nothing else was open
        if (!state.showNoteSearch && !isRenaming && actionMenuIndex === 0) {
          await getCurrentWindow().hide()
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
      }

      // Settings Shortcut
      if (e.key.toLowerCase() === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        useAppStore.getState().setShowSettingsModal(true)
      }

      // Graph View Shortcut
      if (e.key.toLowerCase() === 'g' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowGraphView((prev) => !prev)
      }

      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const id = Date.now() + '.md'
        const newNote = { id, content: '', mtime: Date.now() }
        setNotes((prev) => [newNote, ...prev])
        setCurrentNoteIndex(0)
        window.electronAPI.saveNote(id, '')
      }

      if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        const { notes, currentNoteIndex } = useAppStore.getState()
        const note = notes[currentNoteIndex]
        if (note) {
          const filename = note.id.replace(/\.md$/, '')
          window.electronAPI.exportNote(filename, note.content)
        }
      }

      if (e.key.toLowerCase() === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowNoteSearch(true)
        setNoteSearchQuery('')
        setSearchSelectedIndex(0)
      }

      if (e.key.toLowerCase() === 't' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowRemindersView(true)
      }

      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowMainActionMenu((prev) => !prev)
      }
    }

    // Sync global shortcut on load
    const shortcut =
      localStorage.getItem('papercache-shortcut-newnote') || 'CommandOrControl+Shift+N'
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', '', shortcut)
    }
    const toggleShortcut =
      localStorage.getItem('papercache-shortcut-toggle') || 'CommandOrControl+Shift+C'
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
  ])
}
