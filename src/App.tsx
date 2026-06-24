import { useRef, useEffect } from 'react'
import { getVersion } from '@tauri-apps/api/app'

import './App.css'
import GraphView from './GraphView'
import { RemindersPage } from './components/RemindersPage'

import { useAppStore } from './store/useAppStore'
import { useSettingsStore } from './store/useSettingsStore'

import { useNoteStorage } from './hooks/useNoteStorage'
import { useVariables } from './hooks/useVariables'
import { useReminders } from './hooks/useReminders'
import { useGlobalHotkey } from './hooks/useGlobalHotkey'

import { NoteSearch } from './components/NoteSearch'
import { MainActionMenu } from './components/MainActionMenu'
import { NoteTitleBar } from './components/NoteTitleBar'
import { Editor, type EditorRef } from './components/Editor'
import Settings from './Settings'

function App() {
  const notes = useAppStore((state) => state.notes)
  const setNotes = useAppStore((state) => state.setNotes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)
  const showGraphView = useAppStore((state) => state.showGraphView)
  const setShowGraphView = useAppStore((state) => state.setShowGraphView)
  const showRemindersView = useAppStore((state) => state.showRemindersView)
  const setShowRemindersView = useAppStore((state) => state.setShowRemindersView)
  const showNoteSearch = useAppStore((state) => state.showNoteSearch)
  const setShowMainActionMenu = useAppStore((state) => state.setShowMainActionMenu)
  const showSettingsModal = useAppStore((state) => state.showSettingsModal)
  const setShowSettingsModal = useAppStore((state) => state.setShowSettingsModal)

  const { themePreset, fontFamily, showRulings, bgType, bgColor, bgImage, textColor, numColor } =
    useSettingsStore()

  const editorRef = useRef<EditorRef>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Custom Hooks
  useNoteStorage()
  useVariables()
  useReminders()
  useGlobalHotkey()

  useEffect(() => {
    window.electronAPI.checkForUpdates()
    window.electronAPI.isHyprland().then((isHyp) => {
      useAppStore.getState().setIsHyprland(isHyp)
    })
  }, [])

  useEffect(() => {
    if (showNoteSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [showNoteSearch])

  useEffect(() => {
    async function checkVersion() {
      if (notes.length === 0) return
      const currentVersion = await getVersion()
      const lastSeenVersion = localStorage.getItem('papercache-last-seen-version')
      if (lastSeenVersion !== currentVersion) {
        localStorage.setItem('papercache-last-seen-version', currentVersion)
        const targetId = `New Features in v${currentVersion}.md`
        const targetIndex = notes.findIndex((n) => {
          const filename = n.id.split('/').pop() || ''
          return filename === targetId
        })
        if (targetIndex !== -1) {
          setCurrentNoteIndex(targetIndex)
        }
      }
    }
    checkVersion()
  }, [notes, setCurrentNoteIndex])

  const containerStyle: React.CSSProperties = {
    fontFamily: fontFamily,
    '--font-family': fontFamily,
  } as React.CSSProperties

  if (bgType === 'color') {
    containerStyle['--bg-color' as string] = bgColor
    containerStyle.backgroundImage = 'none'
  } else if (bgType === 'image' && bgImage) {
    containerStyle.backgroundImage = `url(${bgImage})`
    containerStyle.backgroundSize = 'cover'
    containerStyle.backgroundPosition = 'center'
    containerStyle.backgroundRepeat = 'no-repeat'
  }

  const handleAppClick = () => {
    setShowMainActionMenu(false)
    editorRef.current?.focus()
  }

  return (
    <div
      className={`app-container ${themePreset} ${showRulings ? 'show-rulings' : ''}`}
      style={containerStyle}
      onClick={handleAppClick}
    >
      <NoteTitleBar />

      {showRemindersView && (
        <RemindersPage
          notes={notes}
          theme={themePreset.includes('dark') ? 'dark' : 'light'}
          onClose={() => setShowRemindersView(false)}
          onNavigateToNote={(noteId) => {
            const idx = notes.findIndex((n) => n.id === noteId)
            if (idx !== -1) {
              setCurrentNoteIndex(idx)
              setShowRemindersView(false)
            }
          }}
          onToggleReminder={(noteId, from, to, insert) => {
            const currentNotes = useAppStore.getState().notes
            const idx = currentNotes.findIndex((n) => n.id === noteId)
            if (idx === -1) return
            const note = currentNotes[idx]
            const newContent = note.content.slice(0, from) + insert + note.content.slice(to)

            // Side-effects outside of state updater
            window.electronAPI.saveNote(note.id, newContent)
            if (idx === currentNoteIndex) {
              editorRef.current?.dispatch({ changes: { from, to, insert } })
            }

            // Pure state update
            setNotes((prevNotes) =>
              prevNotes.map((n) => (n.id === noteId ? { ...n, content: newContent } : n))
            )
          }}
        />
      )}

      <NoteSearch />

      <MainActionMenu />

      {showGraphView && (
        <GraphView
          notes={notes}
          onClose={() => setShowGraphView(false)}
          textColor={textColor}
          bgColor={bgColor}
          accentColor={numColor}
          onNodeClick={(nodeId) => {
            const index = notes.findIndex((n) => n.id === nodeId)
            if (index !== -1) {
              setCurrentNoteIndex(index)
              setShowGraphView(false)
            }
          }}
        />
      )}

      <Editor ref={editorRef} />

      {showSettingsModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: bgType === 'color' ? bgColor : '#1a1a1a',
            zIndex: 9999,
            overflow: 'auto',
          }}
        >
          <Settings onClose={() => setShowSettingsModal(false)} />
        </div>
      )}
    </div>
  )
}

export default App
