import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useGlobalHotkey() {
  const showMainActionMenu = useAppStore((state) => state.showMainActionMenu)
  const showNoteSearch = useAppStore((state) => state.showNoteSearch)
  const showGraphView = useAppStore((state) => state.showGraphView)
  const setShowMainActionMenu = useAppStore((state) => state.setShowMainActionMenu)
  const setShowNoteSearch = useAppStore((state) => state.setShowNoteSearch)
  const setShowGraphView = useAppStore((state) => state.setShowGraphView)
  const setShowRemindersView = useAppStore((state) => state.setShowRemindersView)
  const setZoomLevel = useAppStore((state) => state.setZoomLevel)
  const setNotes = useAppStore((state) => state.setNotes)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)
  const setNoteSearchQuery = useAppStore((state) => state.setNoteSearchQuery)
  const setSearchSelectedIndex = useAppStore((state) => state.setSearchSelectedIndex)

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMainActionMenu) {
          e.preventDefault()
          e.stopPropagation()
          setShowMainActionMenu(false)
          return
        }
        if (showNoteSearch) {
          e.preventDefault()
          e.stopPropagation()
          setShowNoteSearch(false)
          return
        }
        if (showGraphView) {
          e.preventDefault()
          e.stopPropagation()
          setShowGraphView(false)
          return
        }
      }

      // Settings Shortcut
      if (e.key.toLowerCase() === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        window.electronAPI.openSettings()
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

      // Zoom Shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' || e.key === '-')) {
        e.preventDefault()
        setZoomLevel((prev) => {
          const newZoom = e.key === '-' ? Math.max(0.5, prev - 0.1) : Math.min(3, prev + 0.1)
          localStorage.setItem('papercache-zoom', newZoom.toString())
          return newZoom
        })
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        setZoomLevel(1)
        localStorage.setItem('papercache-zoom', '1')
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
    if (window.electronAPI.onTriggerNewNote) {
      window.electronAPI.onTriggerNewNote(() => {
        const id = Date.now() + '.md'
        const initialNote = { id, content: '', mtime: Date.now() }
        setNotes((prev) => [initialNote, ...prev])
        window.electronAPI.saveNote(id, '')
        setCurrentNoteIndex(0)
      })
    }

    if (window.electronAPI.onTriggerTasks) {
      window.electronAPI.onTriggerTasks(() => {
        setShowRemindersView((prev) => !prev)
      })
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
  }, [
    showMainActionMenu,
    showNoteSearch,
    showGraphView,
    setShowGraphView,
    setShowMainActionMenu,
    setShowNoteSearch,
    setNoteSearchQuery,
    setSearchSelectedIndex,
    setShowRemindersView,
    setNotes,
    setCurrentNoteIndex,
    setZoomLevel,
  ])
}
