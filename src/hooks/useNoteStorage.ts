import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { reconcileNotes } from '../lib/reconcileNotes'

export function useNoteStorage() {
  const notes = useAppStore((state) => state.notes)
  const setNotes = useAppStore((state) => state.setNotes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)

  // Load notes initially
  useEffect(() => {
    async function loadNotes() {
      const loaded = await window.electronAPI.getNotes()
      if (loaded.length > 0) {
        setNotes(loaded)
        const lastOpenNoteId = localStorage.getItem('papercache-last-open-note')
        if (lastOpenNoteId) {
          const idx = loaded.findIndex((n) => n.id === lastOpenNoteId)
          if (idx !== -1) {
            setCurrentNoteIndex(idx)
          }
        }
      }
    }
    loadNotes()
  }, [setNotes, setCurrentNoteIndex])

  // Save current note index to localStorage
  useEffect(() => {
    if (notes.length > 0 && currentNoteIndex >= 0 && currentNoteIndex < notes.length) {
      localStorage.setItem('papercache-last-open-note', notes[currentNoteIndex]!.id)
    }
  }, [currentNoteIndex, notes])

  // Listen to external open note events
  useEffect(() => {
    const handleOpenNote = (e: Event) => {
      const customEvent = e as CustomEvent
      let path = customEvent.detail.path.replace(/\\/g, '/')
      if (!path.endsWith('.md')) path += '.md'

      // We need the latest notes, so use useAppStore.getState()
      const currentNotes = useAppStore.getState().notes
      const index = currentNotes.findIndex((n) => n.id === path)
      if (index !== -1) {
        setCurrentNoteIndex(index)
      } else {
        const newNote = { id: path, content: '', mtime: Date.now() }
        window.electronAPI.saveNote(path, '')
        setNotes([newNote, ...currentNotes])
        setCurrentNoteIndex(0)
      }
    }
    window.addEventListener('open-papercache-note', handleOpenNote)
    return () => window.removeEventListener('open-papercache-note', handleOpenNote)
  }, [setNotes, setCurrentNoteIndex])

  // Reconcile with external file changes when the window regains focus.
  // Never overwrites the active unsaved buffer (see reconcileNotes).
  useEffect(() => {
    async function reconcile() {
      try {
        const fresh = await window.electronAPI.getNotes()
        const state = useAppStore.getState()
        const activeId = state.notes[state.currentNoteIndex]?.id ?? null
        const result = reconcileNotes(state.notes, activeId, state.isEditorDirty, fresh)
        if (result.conflicts.length > 0) {
          state.addToast({
            message: 'A note changed elsewhere while you were editing — your version was kept.',
            type: 'warning',
          })
        }
        setNotes(result.notes)
      } catch {
        // Reconcile is best-effort; never lose the in-memory buffer on failure.
      }
    }
    window.addEventListener('focus', reconcile)
    return () => window.removeEventListener('focus', reconcile)
  }, [setNotes])
}
