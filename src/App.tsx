import { useRef, useEffect } from 'react'

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
import { Editor, EditorRef } from './components/Editor'

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

  const { fontFamily, bgType, bgColor, bgImage } = useSettingsStore()

  const editorRef = useRef<EditorRef>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Custom Hooks
  useNoteStorage()
  useVariables()
  useReminders()
  useGlobalHotkey()

  useEffect(() => {
    if (showNoteSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [showNoteSearch])

  // Listen to storage events to update settings if changed from Settings window
  useEffect(() => {
    const handleStorageChange = () => {
      // Refresh Settings Store
      useSettingsStore.setState({
        themePreset: localStorage.getItem('papercache-theme-preset') || 'grid-light',
        fontFamily: localStorage.getItem('papercache-font') || 'monospace',
        showRulings: localStorage.getItem('papercache-rulings') !== 'false',
        bgType: (localStorage.getItem('papercache-bg-type') as 'color' | 'image') || 'color',
        bgColor: localStorage.getItem('papercache-bg-color') || '#ffffff',
        bgImage: localStorage.getItem('papercache-bg-image') || '',
        textColor: localStorage.getItem('papercache-color-text') || '#333333',
        numColor: localStorage.getItem('papercache-color-num') || '#8ab4f8',
        symColor: localStorage.getItem('papercache-color-sym') || '#c586c0',
        aiColor: localStorage.getItem('papercache-ai-color') || '#8b5cf6',
        mathColor: localStorage.getItem('papercache-math-color') || '#10b981',
      })
      // Refresh AI Store
      useAIStore.setState({
        apiBaseUrl:
          localStorage.getItem('papercache-api-base-url') || 'https://openrouter.ai/api/v1',
        apiModel:
          localStorage.getItem('papercache-api-model') || 'nvidia/nemotron-3-super-120b-a12b:free',
        aiSystemPrompt:
          localStorage.getItem('papercache-ai-system-prompt') ||
          'You are a helpful assistant directly inside a markdown note. You can format your responses with markdown.',
      })
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const containerStyle: React.CSSProperties = {
    fontFamily: fontFamily === 'monospace' ? 'var(--font-mono)' : 'var(--font-sans)',
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
            setNotes((prevNotes) => {
              const newNotes = [...prevNotes]
              const idx = newNotes.findIndex((n) => n.id === noteId)
              if (idx !== -1) {
                const note = newNotes[idx]
                const newContent = note.content.slice(0, from) + insert + note.content.slice(to)
                newNotes[idx] = { ...note, content: newContent }
                window.electronAPI.saveNote(note.id, newContent)

                if (idx === currentNoteIndex) {
                  editorRef.current?.dispatch({ changes: { from, to, insert } })
                }
              }
              return newNotes
            })
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
    </div>
  )
}

export default App
