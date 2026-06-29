import { useRef, useEffect, lazy, Suspense } from 'react'
import { getVersion } from '@tauri-apps/api/app'

import './App.css'
const GraphView = lazy(() => import('./GraphView'))
import { RemindersPage } from './components/RemindersPage'
import { TimersPage } from './components/TimersPage'
import { KeybindsModal } from './components/KeybindsModal'

import { useAppStore } from './store/useAppStore'
import { useSettingsStore } from './store/useSettingsStore'
import { useTimerStore } from './store/useTimerStore'
import { listen } from '@tauri-apps/api/event'

import { useNoteStorage } from './hooks/useNoteStorage'
import { useVariables } from './hooks/useVariables'
import { useReminders } from './hooks/useReminders'
import { useGlobalHotkey } from './hooks/useGlobalHotkey'

import { NoteSearch } from './components/NoteSearch'
import { MainActionMenu } from './components/MainActionMenu'
import { NoteTitleBar } from './components/NoteTitleBar'
import { Editor, type EditorRef } from './components/Editor'
import Settings from './Settings'

const TOAST_TIMEOUT_MS = 5000
const MODAL_Z_INDEX = 9999
const KEYBINDS_Z_INDEX = 10000
const TOAST_Z_INDEX = 99999

function App() {
  const notes = useAppStore((state) => state.notes)
  const setNotes = useAppStore((state) => state.setNotes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const setCurrentNoteIndex = useAppStore((state) => state.setCurrentNoteIndex)
  const showGraphView = useAppStore((state) => state.showGraphView)
  const setShowGraphView = useAppStore((state) => state.setShowGraphView)
  const showRemindersView = useAppStore((state) => state.showRemindersView)
  const setShowRemindersView = useAppStore((state) => state.setShowRemindersView)
  const showTimersView = useAppStore((state) => state.showTimersView)
  const setShowTimersView = useAppStore((state) => state.setShowTimersView)
  const toasts = useAppStore((state) => state.toasts)
  const removeToast = useAppStore((state) => state.removeToast)
  const setShowMainActionMenu = useAppStore((state) => state.setShowMainActionMenu)
  const showSettingsModal = useAppStore((state) => state.showSettingsModal)
  const setShowSettingsModal = useAppStore((state) => state.setShowSettingsModal)
  const showKeybindsModal = useAppStore((state) => state.showKeybindsModal)
  const setShowKeybindsModal = useAppStore((state) => state.setShowKeybindsModal)

  const { themePreset, fontFamily, showRulings, bgType, bgColor, bgImage, textColor, numColor } =
    useSettingsStore()

  const editorRef = useRef<EditorRef>(null)

  useNoteStorage()
  useVariables()
  useReminders()
  useGlobalHotkey()

  useEffect(() => {
    window.electronAPI.checkForUpdates()
    window.electronAPI.restoreWindowState()
    window.electronAPI.isHyprland().then((isHyp) => {
      useAppStore.getState().setIsHyprland(isHyp)
    })

    const disposeUpdateReady = window.electronAPI.onUpdateReady(() => {
      useAppStore.getState().addToast({
        message: '✨ PaperCache updated — restarting in 3 seconds…',
        type: 'info',
      })
    })

    useTimerStore.getState().cleanExpiredTimers()

    let unlistenTimer: (() => void) | undefined
    let isUnmounted = false
    listen<string>('timer-complete', (event) => {
      const id = event.payload
      useTimerStore.getState().completeTimer(id)
      const t = useTimerStore.getState().timers.find((x) => x.id === id)
      useAppStore
        .getState()
        .addToast({ message: `⏱ Timer done: ${t?.label || ''}`, type: 'success' })
    }).then((fn) => {
      if (isUnmounted) fn()
      else unlistenTimer = fn
    })

    return () => {
      isUnmounted = true
      disposeUpdateReady()
      unlistenTimer?.()
    }
  }, [])

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const timers = toastTimersRef.current
    const currentIds = new Set(toasts.map((t) => t.id))

    for (const [id, timer] of timers) {
      if (!currentIds.has(id)) {
        clearTimeout(timer)
        timers.delete(id)
      }
    }

    for (const toast of toasts) {
      if (!timers.has(toast.id)) {
        timers.set(
          toast.id,
          setTimeout(() => removeToast(toast.id), TOAST_TIMEOUT_MS)
        )
      }
    }
  }, [toasts, removeToast])

  useEffect(() => {
    async function checkVersion() {
      if (notes.length === 0) return
      const currentVersion = await getVersion()
      const lastSeenVersion = localStorage.getItem('papercache-last-seen-version')

      if (lastSeenVersion !== currentVersion) {
        const targetId = `New Features in v${currentVersion}.md`
        const targetIndex = notes.findIndex((n) => {
          const filename = n.id.split('/').pop() || ''
          return filename === targetId
        })

        if (targetIndex !== -1) {
          localStorage.setItem('papercache-last-seen-version', currentVersion)
          setCurrentNoteIndex(targetIndex)
        } else if (lastSeenVersion === null) {
          const welcomeIndex = notes.findIndex((n) => {
            const filename = n.id.split('/').pop() || ''
            return filename === 'Welcome.md'
          })
          if (welcomeIndex !== -1) {
            localStorage.setItem('papercache-last-seen-version', currentVersion)
            setCurrentNoteIndex(welcomeIndex)
          }
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

            window.electronAPI.saveNote(note.id, newContent)
            if (idx === currentNoteIndex) {
              editorRef.current?.dispatch({ changes: { from, to, insert } })
            }

            setNotes((prevNotes) =>
              prevNotes.map((n) => (n.id === noteId ? { ...n, content: newContent } : n))
            )
          }}
        />
      )}

      <NoteSearch />

      <MainActionMenu />

      {showTimersView && <TimersPage onClose={() => setShowTimersView(false)} />}

      {showGraphView && (
        <Suspense fallback={null}>
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
        </Suspense>
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
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: MODAL_Z_INDEX,
            overflow: 'auto',
          }}
        >
          <Settings onClose={() => setShowSettingsModal(false)} />
        </div>
      )}

      {showKeybindsModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: KEYBINDS_Z_INDEX,
            overflow: 'auto',
          }}
        >
          <KeybindsModal onClose={() => setShowKeybindsModal(false)} />
        </div>
      )}

      {/* In-app toast notifications */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: TOAST_Z_INDEX,
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={() => removeToast(toast.id)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background:
                  toast.type === 'success'
                    ? 'rgba(16, 185, 129, 0.95)'
                    : toast.type === 'error'
                      ? 'rgba(239, 68, 68, 0.95)'
                      : toast.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.95)'
                        : 'rgba(59, 130, 246, 0.95)',
                color: '#fff',
                fontSize: 13,
                fontFamily: fontFamily,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                maxWidth: 320,
                animation: 'toast-in 0.25s ease',
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
