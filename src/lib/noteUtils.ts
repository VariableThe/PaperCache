import { useAppStore } from '../store/useAppStore'

export async function confirmAndDeleteNotes(
  noteIds: string | string[],
  onSuccess?: () => void
): Promise<boolean> {
  const ids = Array.isArray(noteIds) ? noteIds : [noteIds]
  const validIds = ids.filter((id) => !id.startsWith('commands/'))

  if (validIds.length === 0) {
    if (ids.some((id) => id.startsWith('commands/'))) {
      alert('Files in the commands folder cannot be deleted.')
    }
    return false
  }

  await window.electronAPI.setDialogOpen(true)
  const confirmed = await confirm(
    validIds.length > 1 ? `Delete ${validIds.length} notes?` : 'Delete this note?',
    {
      title: 'PaperCache',
      kind: 'warning',
    }
  )
  await window.electronAPI.setDialogOpen(false)

  if (!confirmed) return false

  for (const id of validIds) {
    await window.electronAPI.deleteNote(id)
  }

  const { notes, currentNoteIndex, setNotes, setCurrentNoteIndex } = useAppStore.getState()
  const nextNotes = notes.filter((n) => !validIds.includes(n.id))
  setNotes(nextNotes)

  if (nextNotes.length > 0) {
    const currentNote = notes[currentNoteIndex]
    if (currentNote && validIds.includes(currentNote.id)) {
      setCurrentNoteIndex(Math.max(0, Math.min(currentNoteIndex, nextNotes.length - 1)))
    } else if (currentNoteIndex >= nextNotes.length) {
      setCurrentNoteIndex(Math.max(0, nextNotes.length - 1))
    }
  } else {
    setCurrentNoteIndex(0)
  }

  onSuccess?.()
  return true
}
