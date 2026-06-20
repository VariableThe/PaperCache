import { useCallback, useMemo, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, ViewUpdate, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { syntaxHighlighting } from '@codemirror/language'
import { search } from '@codemirror/search'
import { insertTab, indentLess } from '@codemirror/commands'

import './App.css'
import GraphView from './GraphView'
import { RemindersPage } from './components/RemindersPage'

import { useAppStore } from './store/useAppStore'
import { useSettingsStore } from './store/useSettingsStore'
import { useAIStore } from './store/useAIStore'

import { useNoteStorage } from './hooks/useNoteStorage'
import { useVariables } from './hooks/useVariables'
import { useReminders } from './hooks/useReminders'
import { useGlobalHotkey } from './hooks/useGlobalHotkey'

import { mdHighlighting } from './lib/editor/matchers'
import {
  numberPlugin,
  symbolPlugin,
  aiPlugin,
  mathPlugin,
  decomposedPlugins,
} from './lib/editor/plugins'
import { NoteSearch } from './components/NoteSearch'
import { MainActionMenu } from './components/MainActionMenu'
import { NoteTitleBar } from './components/NoteTitleBar'
import { getSecure } from './lib/safeStorage'

import { MathEvaluator } from './lib/editor/MathEvaluator'

function App() {
  const {
    notes,
    setNotes,
    currentNoteIndex,
    setCurrentNoteIndex,
    zoomLevel,
    showGraphView,
    setShowGraphView,
    showRemindersView,
    setShowRemindersView,
    showNoteSearch,
    setShowMainActionMenu,
  } = useAppStore()

  const {
    themePreset,
    fontFamily,
    showRulings,
    bgType,
    bgColor,
    bgImage,
    textColor,
    numColor,
    symColor,
    aiColor,
    mathColor,
  } = useSettingsStore()

  const { apiBaseUrl, apiModel, aiSystemPrompt, setApiKey, apiKey } = useAIStore()

  // Load Secure API Key asynchronously on mount
  useEffect(() => {
    async function fetchApiKey() {
      const key = await getSecure('papercache-apikey')
      if (key) {
        setApiKey(key)
      }
    }
    fetchApiKey()
  }, [setApiKey])

  const editorRef = useRef<{ view?: EditorView } | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeNote = notes[currentNoteIndex] || { id: '', content: '', mtime: 0 }

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
      // Refresh AI Store (API Key handled securely, we don't listen to localStorage for it directly)
      useAIStore.setState({
        apiBaseUrl:
          localStorage.getItem('papercache-api-base-url') || 'https://openrouter.ai/api/v1',
        apiModel:
          localStorage.getItem('papercache-api-model') || 'nvidia/nemotron-3-super-120b-a12b:free',
        aiSystemPrompt:
          localStorage.getItem('papercache-ai-system-prompt') ||
          'You are a helpful assistant directly inside a markdown note. You can format your responses with markdown.',
      })
      // Fetch Secure API Key again
      getSecure('papercache-apikey').then((key) => {
        if (key) setApiKey(key)
      })
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [setApiKey])

  const handleEditorChange = useCallback(
    (val: string, viewUpdate?: ViewUpdate) => {
      const updatedNotes = [...notes]
      if (updatedNotes[currentNoteIndex]) {
        updatedNotes[currentNoteIndex].content = val
        setNotes(updatedNotes)
        window.electronAPI.saveNote(activeNote.id, val)
      }

      if (viewUpdate?.transactions?.some((tr) => tr.docChanged)) {
        if (editorRef.current?.view) {
          MathEvaluator.triggerMathEvaluation(editorRef.current.view)
        }
      }
    },
    [notes, currentNoteIndex, activeNote.id, setNotes]
  )

  const containerStyle: React.CSSProperties & Record<string, string | number> = {
    '--font-family': fontFamily,
    '--text-color': textColor,
    '--custom-color-num': numColor,
    '--custom-color-sym': symColor,
    '--custom-color-ai': aiColor,
    '--custom-color-math': mathColor,
    zoom: zoomLevel,
  }

  if (bgType === 'color') {
    containerStyle['--bg-color'] = bgColor
    containerStyle.backgroundImage = 'none'
  } else if (bgType === 'image' && bgImage) {
    containerStyle.backgroundImage = `url(${bgImage})`
    containerStyle.backgroundSize = 'cover'
    containerStyle.backgroundPosition = 'center'
    containerStyle.backgroundRepeat = 'no-repeat'
  }

  const editorExtensions = useMemo(
    () => [
      EditorView.lineWrapping,
      Prec.highest(
        // eslint-disable-next-line react-hooks/refs
        keymap.of([
          { key: 'Tab', preventDefault: true, run: insertTab },
          { key: 'Shift-Tab', preventDefault: true, run: indentLess },
          {
            key: 'Mod-h',
            run: (view) => {
              const selection = view.state.selection.main
              if (!selection.empty) {
                const selectedText = view.state.doc.sliceString(selection.from, selection.to)
                view.dispatch({
                  changes: {
                    from: selection.from,
                    to: selection.to,
                    insert: `==${selectedText}==`,
                  },
                  selection: { anchor: selection.from + 2, head: selection.to + 2 },
                })
                return true
              }
              return false
            },
          },
          {
            key: 'Mod-e',
            run: () => {
              const note = useAppStore.getState().notes[useAppStore.getState().currentNoteIndex]
              if (note) {
                const filename = note.id.split('/').pop() || 'note.md'
                window.electronAPI.exportNote(filename, note.content)
              }
              return true
            },
          },
          {
            key: 'Mod-Backspace',
            run: () => {
              const note = useAppStore.getState().notes[useAppStore.getState().currentNoteIndex]
              if (note) {
                if (note.id.startsWith('commands/')) {
                  alert('Files in the commands folder cannot be deleted.')
                  return true
                }
                if (confirm('Delete this note?')) {
                  window.electronAPI.deleteNote(note.id)
                  setNotes((prev) => prev.filter((n) => n.id !== note.id))
                  if (
                    useAppStore.getState().currentNoteIndex >=
                    useAppStore.getState().notes.length - 1
                  )
                    setCurrentNoteIndex(Math.max(0, useAppStore.getState().notes.length - 2))
                }
              }
              return true
            },
          },
          {
            key: 'Mod-Delete',
            run: () => {
              const note = useAppStore.getState().notes[useAppStore.getState().currentNoteIndex]
              if (note) {
                if (note.id.startsWith('commands/')) {
                  alert('Files in the commands folder cannot be deleted.')
                  return true
                }
                if (confirm('Delete this note?')) {
                  window.electronAPI.deleteNote(note.id)
                  setNotes((prev) => prev.filter((n) => n.id !== note.id))
                  if (
                    useAppStore.getState().currentNoteIndex >=
                    useAppStore.getState().notes.length - 1
                  )
                    setCurrentNoteIndex(Math.max(0, useAppStore.getState().notes.length - 2))
                }
              }
              return true
            },
          },
          {
            key: 'Enter',
            run: (view) => {
              const pos = view.state.selection.main.head
              const line = view.state.doc.lineAt(pos)
              const lineText = line.text.trim()
              const lowerLine = lineText.toLowerCase()
              if (
                lowerLine.startsWith('/ai') ||
                lowerLine.startsWith('/ctx') ||
                lowerLine.startsWith('/context')
              ) {
                const isCtx = lowerLine.startsWith('/ctx') || lowerLine.startsWith('/context')
                const prefixLength = lowerLine.startsWith('/context')
                  ? 8
                  : lowerLine.startsWith('/ctx')
                    ? 4
                    : 3
                const prompt = lineText.substring(prefixLength).trim()
                if (!apiKey) {
                  const errorText = '\n\u200BError - Set your OpenAI API key in settings\u200C\n'
                  view.dispatch({ changes: { from: line.to, insert: errorText } })
                  return true
                }

                const thinkingText = '\n\u200B...\u200C\n'
                view.dispatch({ changes: { from: line.to, insert: thinkingText } })
                ;(async () => {
                  try {
                    let finalBaseUrl = apiBaseUrl.trim()
                    if (finalBaseUrl.endsWith('/chat/completions')) {
                      finalBaseUrl = finalBaseUrl.replace('/chat/completions', '')
                    }
                    if (finalBaseUrl.endsWith('/')) {
                      finalBaseUrl = finalBaseUrl.slice(0, -1)
                    }

                    const systemContent = aiSystemPrompt.trim()
                    const messages: { role: 'user' | 'system'; content: string }[] = []
                    if (systemContent) {
                      messages.push({ role: 'system', content: systemContent })
                    }

                    let finalPrompt = prompt
                    if (isCtx) {
                      const fullNoteText = view.state.doc.toString()
                      const MAX_CONTEXT_LENGTH = 50000
                      let contextText = fullNoteText
                      if (contextText.length > MAX_CONTEXT_LENGTH) {
                        contextText =
                          contextText.substring(0, MAX_CONTEXT_LENGTH) +
                          '\n...[Context truncated due to length]'
                      }
                      finalPrompt = `Context:\n${contextText}\n\nPrompt:\n${prompt}`
                    }

                    messages.push({ role: 'user', content: finalPrompt })

                    window.electronAPI
                      .openAIChat({
                        model: apiModel.trim() || 'nvidia/nemotron-3-super-120b-a12b:free',
                        messages: messages,
                        apiKey: apiKey.trim() || '',
                        baseURL: finalBaseUrl || '',
                      })
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .then((completion: any) => {
                        let response: string
                        if (completion.choices && completion.choices.length > 0) {
                          response = completion.choices[0].message?.content || ''
                        } else if (completion.error) {
                          throw new Error(completion.error.message || 'Unknown API Error')
                        } else {
                          throw new Error(
                            'Unexpected response format: ' + JSON.stringify(completion)
                          )
                        }

                        const docStr = view.state.doc.toString()
                        const finalVal = docStr.replace(
                          '\n\u200B...\u200C\n',
                          '\n\u200B' + response + '\u200C\n'
                        )
                        handleEditorChange(finalVal)
                      })
                      .catch((error) => {
                        const docStr = view.state.doc.toString()
                        const errorVal = docStr.replace(
                          '\n\u200B...\u200C\n',
                          '\n\u200BError - ' + error.message + '\u200C\n'
                        )
                        handleEditorChange(errorVal)
                      })
                  } catch (err: unknown) {
                    const docStr = view.state.doc.toString()
                    const errorVal = docStr.replace(
                      '\n\u200B...\u200C\n',
                      '\n\u200BSetup Error - ' +
                        ((err as Error).message || String(err)) +
                        '\u200C\n'
                    )
                    handleEditorChange(errorVal)
                  }
                })()

                return true
              }
              return false
            },
          },
        ])
      ),
      search({ top: true }),
      markdown(),
      syntaxHighlighting(mdHighlighting),
      numberPlugin,
      symbolPlugin,
      aiPlugin,
      mathPlugin,
      ...decomposedPlugins,
      EditorView.domEventHandlers({
        mousedown: (event) => {
          const target = event.target as HTMLElement
          const webLink = target?.closest('.cm-custom-clickable-link')
          const fileLink = target?.closest('.cm-custom-file-link')

          if ((webLink || fileLink) && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            if (webLink) {
              const url = webLink.getAttribute('data-url')
              if (url) {
                let finalUrl = url
                if (!/^https?:\/\//i.test(finalUrl)) {
                  finalUrl = 'https://' + finalUrl
                }
                window.electronAPI.openExternal(finalUrl)
              }
            } else if (fileLink) {
              const path = fileLink.getAttribute('data-path')
              if (path) {
                window.dispatchEvent(new CustomEvent('open-papercache-note', { detail: { path } }))
              }
            }
            return true
          }
          return false
        },
      }),
    ],
    [
      apiKey,
      apiBaseUrl,
      apiModel,
      aiSystemPrompt,
      handleEditorChange,
      setCurrentNoteIndex,
      setNotes,
    ]
  )

  useEffect(() => {
    const handleWindowFocus = () => {
      if (editorRef.current?.view && !editorRef.current.view.hasFocus) {
        editorRef.current.view.focus()
      }
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  const handleAppClick = () => {
    setShowMainActionMenu(false)
    if (editorRef.current?.view && !editorRef.current.view.hasFocus) {
      editorRef.current.view.focus()
    }
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
                  const view = editorRef.current?.view
                  if (view) {
                    view.dispatch({ changes: { from, to, insert } })
                  }
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

      <div className="editor-container">
        <CodeMirror
          ref={editorRef}
          value={activeNote.content}
          onChange={handleEditorChange}
          extensions={editorExtensions}
          theme={themePreset === 'grid-dark' || themePreset === 'blueprint' ? 'dark' : 'light'}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            highlightSpecialChars: false,
          }}
        />
      </div>
    </div>
  )
}

export default App
