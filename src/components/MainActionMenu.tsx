import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'

export function MainActionMenu() {
  const notes = useAppStore((state) => state.notes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const showMainActionMenu = useAppStore((state) => state.showMainActionMenu)
  const setShowNoteSearch = useAppStore((state) => state.setShowNoteSearch)
  const setShowGraphView = useAppStore((state) => state.setShowGraphView)
  const setShowRemindersView = useAppStore((state) => state.setShowRemindersView)

  const { bgType, bgColor, textColor, fontFamily } = useSettingsStore()

  if (!showMainActionMenu) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        gap: 12,
        padding: 12,
        background: bgType === 'color' ? bgColor : 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(128, 128, 128, 0.2)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 100,
        fontFamily: fontFamily,
      }}
    >
      <button
        onClick={() => window.electronAPI.openSettings()}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Settings
      </button>
      <button
        onClick={() => setShowNoteSearch(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Search
      </button>
      <button
        onClick={() => setShowGraphView(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Graph View
      </button>
      <button
        onClick={() => setShowRemindersView(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Tasks
      </button>
      <button
        onClick={() => {
          const note = notes[currentNoteIndex]
          if (note) {
            const filename = note.id.split('/').pop() || 'note.md'
            window.electronAPI.exportNote(filename, note.content)
          }
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Export
      </button>
    </div>
  )
}
