import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Note } from '../store/useAppStore'

export function useNoteStorage() {
  const { notes, setNotes, currentNoteIndex, setCurrentNoteIndex } = useAppStore()

  // Load notes initially
  useEffect(() => {
    async function loadNotes() {
      const loaded = await window.electronAPI.getNotes()
      if (loaded.length > 0) {
        setNotes(loaded)
        const lastOpenNoteId = localStorage.getItem('papercache-last-open-note')
        if (lastOpenNoteId) {
          const idx = loaded.findIndex((n: Note) => n.id === lastOpenNoteId)
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
      localStorage.setItem('papercache-last-open-note', notes[currentNoteIndex].id)
    }
  }, [currentNoteIndex, notes])

  // Listen to external open note events
  useEffect(() => {
    const handleOpenNote = (e: any) => {
      let path = e.detail.path
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
}
