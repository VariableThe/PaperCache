import { useAppStore, type Note } from '../store/useAppStore'
import { getFolderColor } from '../utils'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'

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

  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [tagActionMenuIndex, setTagActionMenuIndex] = useState(0)
  const [tagMenuPos, setTagMenuPos] = useState({ x: 0, y: 0 })

  if (!showNoteSearch) return null

  const getNoteTitle = (n: Note) => {
    const isAuto = /^\d+\.md$/.test(n.id)
    const fileName = n.id.replace(/\.md$/, '').split('/').pop() || ''
    return isAuto ? n.content.split('\n')[0].trim() || 'New Note' : fileName
  }

  const getNoteTags = (n: Note): string[] => {
    const matches = n.content.match(/![a-zA-Z0-9_-]+/g)
    return matches || []
  }

  const tagMatch = (tag: string) => (n: Note) =>
    getNoteTags(n).some((t) => t.toLowerCase() === tag.toLowerCase())

  const filteredNotes = notes.filter(
    (n) =>
      n.content.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
      n.id.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
      getNoteTitle(n).toLowerCase().includes(noteSearchQuery.toLowerCase())
  )

  const allTags = new Set<string>()
  notes.forEach((n) => {
    getNoteTags(n).forEach((m) => allTags.add(m.toLowerCase()))
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
          if (activeTag) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setTagActionMenuIndex((prev) => Math.min(prev + 1, 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setTagActionMenuIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const tag = activeTag
              setActiveTag(null)
              if (!tag) return
              const matchNotes = notes.filter(tagMatch(tag))
              if (tagActionMenuIndex === 0) {
                const doDelete = async () => {
                  const notesToDelete = matchNotes
                  await window.electronAPI.setDialogOpen(true)
                  const confirmed = await confirm(
                    `Delete ${notesToDelete.length} notes containing tag ${tag}?`,
                    { title: 'PaperCache', kind: 'warning' }
                  )
                  await window.electronAPI.setDialogOpen(false)
                  if (confirmed) {
                    for (const n of notesToDelete) {
                      if (!n.id.startsWith('commands/')) {
                        await window.electronAPI.deleteNote(n.id)
                      }
                    }
                    setNotes((prev) =>
                      prev.filter(
                        (n) =>
                          !notesToDelete.some(
                            (del) => del.id === n.id && !del.id.startsWith('commands/')
                          )
                      )
                    )
                  }
                }
                doDelete()
              } else if (tagActionMenuIndex === 1) {
                const doExport = async () => {
                  const notesToExport = matchNotes
                  const combinedContent = notesToExport
                    .map((n) => {
                      const title = getNoteTitle(n)
                      return `# ${title}\n\n${n.content}`
                    })
                    .join('\n\n---\n\n')
                  const safeTag = tag.replace(/[^a-zA-Z0-9]/g, '_')
                  await window.electronAPI.exportNote(`export_${safeTag}.md`, combinedContent)
                }
                doExport()
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setActiveTag(null)
            }
            return
          }

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
        {activeTag && (
          <div
            className="tag-action-menu"
            style={{
              position: 'fixed',
              top: tagMenuPos.y,
              left: tagMenuPos.x,
              zIndex: 1000,
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                borderBottom: '1px solid rgba(128,128,128,0.2)',
                marginBottom: '4px',
              }}
            >
              Tag: {activeTag}
            </div>
            <button
              className={tagActionMenuIndex === 0 ? 'focused' : ''}
              style={{
                background: tagActionMenuIndex === 0 ? 'var(--border-color)' : 'transparent',
                border: 'none',
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: '4px',
              }}
              onClick={async (e) => {
                e.stopPropagation()
                const tag = activeTag
                setActiveTag(null)
                if (!tag) return
                const notesToDelete = notes.filter(tagMatch(tag))
                await window.electronAPI.setDialogOpen(true)
                const confirmed = await confirm(
                  `Delete ${notesToDelete.length} notes containing tag ${tag}?`,
                  { title: 'PaperCache', kind: 'warning' }
                )
                await window.electronAPI.setDialogOpen(false)
                if (confirmed) {
                  for (const n of notesToDelete) {
                    if (!n.id.startsWith('commands/')) {
                      await window.electronAPI.deleteNote(n.id)
                    }
                  }
                  setNotes((prev) =>
                    prev.filter(
                      (n) =>
                        !notesToDelete.some(
                          (del) => del.id === n.id && !del.id.startsWith('commands/')
                        )
                    )
                  )
                  if (notesToDelete.some((n) => n.id === notes[currentNoteIndex]?.id)) {
                    setCurrentNoteIndex(0)
                  }
                }
              }}
            >
              Delete All
            </button>
            <button
              className={tagActionMenuIndex === 1 ? 'focused' : ''}
              style={{
                background: tagActionMenuIndex === 1 ? 'var(--border-color)' : 'transparent',
                border: 'none',
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'block',
                width: '100%',
                textAlign: 'left',
              }}
              onClick={async (e) => {
                e.stopPropagation()
                const tag = activeTag
                setActiveTag(null)
                if (!tag) return
                const notesToExport = notes.filter(tagMatch(tag))
                const combinedContent = notesToExport
                  .map((n) => {
                    const title = getNoteTitle(n)
                    return `# ${title}\n\n${n.content}`
                  })
                  .join('\n\n---\n\n')
                const safeTag = tag.replace(/[^a-zA-Z0-9]/g, '_')
                await window.electronAPI.exportNote(`export_${safeTag}.md`, combinedContent)
              }}
            >
              Export All
            </button>
          </div>
        )}
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
                title="Right-click to Delete or Export"
                style={{ cursor: 'pointer', margin: 0, fontSize: '11px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const newQ = noteSearchQuery ? noteSearchQuery + ' ' + tag : tag
                  setNoteSearchQuery(newQ)
                  setSearchSelectedIndex(0)
                  setActiveTag(null)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActiveTag(tag)
                  setTagActionMenuIndex(0)
                  setTagMenuPos({ x: e.clientX, y: e.clientY })
                  setShowNoteActionMenu(false)
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="note-search-list" onClick={() => setActiveTag(null)}>
          {filteredNotes.map((n, index) => {
            const title = getNoteTitle(n)
            const pathParts = n.id.replace(/\.md$/, '').split('/')
            pathParts.pop()
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
