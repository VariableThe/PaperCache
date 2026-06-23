import { useAppStore } from '../store/useAppStore'
import { getFolderColor } from '../utils'
import { confirm } from '@tauri-apps/plugin-dialog'

export function NoteSearch() {
  const notes = useAppStore((state) => state.notes)
  const setNotes = useAppStore((state) => state.setNotes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)
  const showNoteSearch = useAppStore((state) => state.showNoteSearch)
  const setShowNoteSearch = useAppStore((state) => state.setShowNoteSearch)
  const noteSearchQuery = useAppStore((state) => state.noteSearchQuery)
  const setNoteSearchQuery = useAppStore((state) => state.setNoteSearchQuery)
  const searchSelectedIndex = useAppStore((state) => state.searchSelectedIndex)
  const setSearchSelectedIndex = useAppStore((state) => state.setSearchSelectedIndex)
  const showNoteActionMenu = useAppStore((state) => state.showNoteActionMenu)
  const setShowNoteActionMenu = useAppStore((state) => state.setShowNoteActionMenu)
  const actionMenuIndex = useAppStore((state) => state.actionMenuIndex)
  const setActionMenuIndex = useAppStore((state) => state.setActionMenuIndex)
  const isHyprland = useAppStore((state) => state.isHyprland)

  if (!showNoteSearch) return null

  const filteredNotes = notes.filter(
    (n) =>
      n.content.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
      n.id.toLowerCase().includes(noteSearchQuery.toLowerCase())
  )

  const allTags = new Set<string>()
  notes.forEach((n) => {
    const matches = n.content.match(/![a-zA-Z0-9_-]+/g)
    if (matches) {
      matches.forEach((m) => allTags.add(m.toLowerCase()))
    }
  })
  const tagArray = Array.from(allTags).sort()

  return (
    <div
      className="note-search-overlay"
      onClick={() => {
        setShowNoteSearch(false)
        setShowNoteActionMenu(false)
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className="note-search-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (showNoteActionMenu) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActionMenuIndex((prev) => Math.min(prev + 1, 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActionMenuIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const selNote = filteredNotes[searchSelectedIndex]
              if (!selNote) return
              if (actionMenuIndex === 0) {
                if (selNote.id.startsWith('commands/')) {
                  alert('Files in the commands folder cannot be deleted.')
                  setShowNoteActionMenu(false)
                  return
                }
                const doDelete = async () => {
                  await window.electronAPI.setDialogOpen(true)
                  const confirmed = await confirm('Delete this note?', {
                    title: 'PaperCache',
                    kind: 'warning',
                  })
                  await window.electronAPI.setDialogOpen(false)
                  if (confirmed) {
                    window.electronAPI.deleteNote(selNote.id).then((success) => {
                      if (success) {
                        setNotes((prev) => prev.filter((note) => note.id !== selNote.id))
                        const selIdx = notes.findIndex((n) => n.id === selNote.id)
                        const newIdx =
                          currentNoteIndex >= selIdx && currentNoteIndex > 0
                            ? currentNoteIndex - 1
                            : currentNoteIndex
                        setCurrentNoteIndex(newIdx)
                        setShowNoteSearch(false)
                        setShowNoteActionMenu(false)
                      }
                    })
                  }
                }
                doDelete()
              } else if (actionMenuIndex === 1) {
                const blob = new Blob([selNote.content], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = selNote.id.split('/').pop() || selNote.id
                a.click()
                URL.revokeObjectURL(url)
                setShowNoteActionMenu(false)
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setShowNoteActionMenu(false)
            } else if (e.key === 'k' && (isHyprland ? e.altKey : e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              setShowNoteActionMenu(false)
            }
            return
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSearchSelectedIndex((prev) => Math.min(prev + 1, filteredNotes.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSearchSelectedIndex((prev) => Math.max(prev - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (showNoteActionMenu) return
            if (filteredNotes.length > 0) {
              const selNote = filteredNotes[searchSelectedIndex]
              const idx = notes.findIndex((note) => note.id === selNote.id)
              if (idx !== -1) setCurrentNoteIndex(idx)
              setShowNoteSearch(false)
            }
          } else if (e.key === 'k' && (isHyprland ? e.altKey : e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (filteredNotes.length > 0) {
              setShowNoteActionMenu(true)
              setActionMenuIndex(0)
            }
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setShowNoteSearch(false)
          }
        }}
      >
        <input
          autoFocus
          className="note-search-input"
          placeholder="Search notes by content..."
          value={noteSearchQuery}
          onChange={(e) => {
            setNoteSearchQuery(e.target.value)
            setSearchSelectedIndex(0)
            setShowNoteActionMenu(false)
          }}
        />
        {tagArray.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              borderBottom: '1px solid rgba(128,128,128,0.1)',
            }}
          >
            {tagArray.map((tag) => (
              <span
                key={tag}
                className="cm-tag-pill"
                style={{ cursor: 'pointer', margin: 0, fontSize: '11px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const newQ = noteSearchQuery ? noteSearchQuery + ' ' + tag : tag
                  setNoteSearchQuery(newQ)
                  setSearchSelectedIndex(0)
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="note-search-list">
          {filteredNotes.map((n, index) => {
            const isAuto = /^\d+\.md$/.test(n.id)
            const pathParts = n.id.replace(/\.md$/, '').split('/')
            const fileName = pathParts.pop() || ''
            const title = isAuto ? n.content.split('\n')[0].trim() || 'New Note' : fileName
            const isSelected = index === searchSelectedIndex
            return (
              <div
                key={n.id}
                className={`note-search-item ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setSearchSelectedIndex(index)}
                onClick={() => {
                  const idx = notes.findIndex((note) => note.id === n.id)
                  if (idx !== -1) setCurrentNoteIndex(idx)
                  setShowNoteSearch(false)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setSearchSelectedIndex(index)
                  setShowNoteActionMenu(true)
                  setActionMenuIndex(0)
                }}
              >
                <div className="ns-left">
                  <span className="ns-title">{title}</span>
                  {pathParts.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: getFolderColor(pathParts[0]),
                        }}
                      />
                      <span className="ns-folder">{pathParts.join(' / ')}</span>
                    </div>
                  )}
                </div>
                <span className="ns-date">{new Date(n.mtime).toLocaleDateString()}</span>

                {isSelected && showNoteActionMenu && (
                  <div className="note-action-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={actionMenuIndex === 0 ? 'focused' : ''}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (n.id.startsWith('commands/')) {
                          alert('Files in the commands folder cannot be deleted.')
                          setShowNoteActionMenu(false)
                          return
                        }
                        const doDelete = async () => {
                          await window.electronAPI.setDialogOpen(true)
                          const confirmed = await confirm('Delete this note?', {
                            title: 'PaperCache',
                            kind: 'warning',
                          })
                          await window.electronAPI.setDialogOpen(false)
                          if (confirmed) {
                            window.electronAPI.deleteNote(n.id).then((success) => {
                              if (success) {
                                setNotes((prev) => prev.filter((note) => note.id !== n.id))
                                const selIdx = notes.findIndex((note) => note.id === n.id)
                                const newIdx =
                                  currentNoteIndex >= selIdx && currentNoteIndex > 0
                                    ? currentNoteIndex - 1
                                    : currentNoteIndex
                                setCurrentNoteIndex(newIdx)
                                setShowNoteSearch(false)
                                setShowNoteActionMenu(false)
                              }
                            })
                          }
                        }
                        doDelete()
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className={actionMenuIndex === 1 ? 'focused' : ''}
                      onClick={(e) => {
                        e.stopPropagation()
                        const blob = new Blob([n.content], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = n.id.split('/').pop() || n.id
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowNoteActionMenu(false)
                      }}
                    >
                      Export
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
