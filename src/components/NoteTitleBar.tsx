import { useAppStore } from '../store/useAppStore'

export function NoteTitleBar() {
  const {
    notes,
    setNotes,
    currentNoteIndex,
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
  } = useAppStore()

  const activeNote = notes[currentNoteIndex] || { id: 'note.md', content: '', mtime: 0 }

  const isAutoNamed = /^\d+\.md$/.test(activeNote.id)
  const displayTitle = isAutoNamed
    ? activeNote.content.split('\n')[0].trim() || 'New Note'
    : activeNote.id.split('/').pop() || ''

  const startRename = () => {
    setRenameValue(displayTitle)
    setIsRenaming(true)
  }

  const handleRenameSubmit = async () => {
    setIsRenaming(false)
    const newName = renameValue.trim()
    if (!newName) return
    const isAutoNamed = /^\d+\.md$/.test(activeNote.id)

    if (isAutoNamed && activeNote.content.trim() === '') {
      const newContent = newName + '\n\n'
      try {
        await window.electronAPI.saveNote(activeNote.id, newContent)
        setNotes((prev) =>
          prev.map((n) => (n.id === activeNote.id ? { ...n, content: newContent } : n))
        )
      } catch (e) {
        console.error('Failed to save note', e)
      }
    } else {
      const parts = activeNote.id.split('/')
      parts.pop()
      const finalName = newName.endsWith('.md') ? newName : newName + '.md'
      parts.push(finalName)
      const newId = parts.join('/')

      try {
        const success = await window.electronAPI.renameNote(activeNote.id, newId)
        if (success) {
          setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? { ...n, id: newId } : n)))
        }
      } catch (e) {
        console.error('Failed to rename note', e)
      }
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  return (
    <div className="drag-region">
      {isRenaming ? (
        <input
          className="rename-input"
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleRenameKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="note-title"
          onClick={(e) => {
            e.stopPropagation()
            startRename()
          }}
          title="Click to rename"
        >
          {displayTitle}
        </span>
      )}
    </div>
  )
}
