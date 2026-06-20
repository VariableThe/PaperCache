import { useCallback, useMemo, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, ViewUpdate, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { syntaxHighlighting } from '@codemirror/language'
import { search } from '@codemirror/search'
import { insertTab, indentLess } from '@codemirror/commands'

import './App.css'
import { getFolderColor } from './utils'
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
  hideMarkdownPlugin,
  remConverterPlugin,
} from './lib/editor/plugins'
import { getSecure } from './lib/safeStorage'

let openaiInstance: any = null
let currentApiKey = ''
let currentApiBaseUrl = ''

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
    isRenaming,
    setIsRenaming,
    renameValue,
    setRenameValue,
    showNoteSearch,
    setShowNoteSearch,
    noteSearchQuery,
    setNoteSearchQuery,
    searchSelectedIndex,
    setSearchSelectedIndex,
    showNoteActionMenu,
    setShowNoteActionMenu,
    showMainActionMenu,
    setShowMainActionMenu,
    actionMenuIndex,
    setActionMenuIndex,
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

  const editorRef = useRef<any>(null)
  const mathCalcTimeoutRef = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {}, [notes])

  useEffect(() => {}, [currentNoteIndex])

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
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [setApiKey])

  const activeNote = notes[currentNoteIndex] || { id: '', content: '' }
  const isAuto = /^\d+\.md$/.test(activeNote.id)
  const pathParts = activeNote.id.replace(/\.md$/, '').split('/')
  const fileName = pathParts.pop() || ''
  const displayTitle = isAuto ? activeNote.content.split('\n')[0].trim() || 'New Note' : fileName

  const startRename = () => {
    setRenameValue(activeNote.id.replace(/\.md$/, ''))
    setIsRenaming(true)
  }

  const handleRenameSubmit = () => {
    setIsRenaming(false)
    if (renameValue && renameValue.trim() && renameValue !== displayTitle) {
      const newId = renameValue.trim() + '.md'
      window.electronAPI.renameNote(activeNote.id, newId)
      const updatedNotes = [...notes]
      updatedNotes[currentNoteIndex].id = newId
      setNotes(updatedNotes)
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  const handleEditorChange = useCallback(
    (val: string, viewUpdate?: ViewUpdate) => {
      const updatedNotes = [...notes]
      if (updatedNotes[currentNoteIndex]) {
        updatedNotes[currentNoteIndex].content = val
        setNotes(updatedNotes)
        window.electronAPI.saveNote(activeNote.id, val)
      }

      if (viewUpdate?.transactions?.some((tr) => tr.docChanged)) {
        if (mathCalcTimeoutRef.current) {
          clearTimeout(mathCalcTimeoutRef.current)
        }
        mathCalcTimeoutRef.current = window.setTimeout(async () => {
          if (!editorRef.current?.view) return
          const view = editorRef.current.view
          const docStr = view.state.doc.toString()
          const head = view.state.selection.main.head
          const line = view.state.doc.lineAt(head)

          let mathjs: any
          try {
            mathjs = await import('mathjs')
          } catch {
            return
          }

          const scope: Record<string, unknown> = Object.assign(
            {},
            (window as unknown as { __globalVariables: Record<string, unknown> })
              .__globalVariables || {}
          )
          const reVar = /^\/var\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm
          let match
          while ((match = reVar.exec(docStr)) !== null) {
            const name = match[1]
            try {
              const val = mathjs.evaluate(match[2], scope)
              scope[name] = val
            } catch {
              scope[name] = match[2].trim()
            }
          }

          const changes: { from: number; to: number; insert: string }[] = []

          if (line.text.endsWith('=')) {
            try {
              const expr = line.text.substring(0, line.text.length - 1).trim()
              if (expr) {
                const result = String(mathjs.evaluate(expr, scope))
                changes.push({
                  from: line.to,
                  to: line.to,
                  insert: '\u200B' + result,
                })
              }
            } catch {}
          }

          const reCalc = /^(.*?=\s*)\u200B(.*)$/gm
          let calcMatch
          while ((calcMatch = reCalc.exec(docStr)) !== null) {
            const exprPart = calcMatch[1]
            const oldResult = calcMatch[2]
            const expr = exprPart.replace(/=$/, '').trim()
            if (expr) {
              try {
                const newResult = String(mathjs.evaluate(expr, scope))
                if (newResult !== oldResult) {
                  const startReplace = calcMatch.index + exprPart.length + 1 // +1 for \u200B
                  const endReplace = calcMatch.index + calcMatch[0].length
                  if (!changes.some((c) => c.from <= endReplace && c.to >= startReplace)) {
                    changes.push({
                      from: startReplace,
                      to: endReplace,
                      insert: newResult,
                    })
                  }
                }
              } catch {}
            }
          }

          if (changes.length > 0) {
            view.dispatch({ changes })
          }
        }, 300)
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

                    if (
                      !openaiInstance ||
                      currentApiKey !== apiKey ||
                      currentApiBaseUrl !== finalBaseUrl
                    ) {
                      const OpenAI = (await import('openai')).default
                      openaiInstance = new OpenAI({
                        apiKey: apiKey.trim() || 'dummy',
                        baseURL: finalBaseUrl || undefined,
                        dangerouslyAllowBrowser: true,
                        defaultHeaders: {
                          'HTTP-Referer': 'https://github.com/papercache/papercache',
                          'X-Title': 'PaperCache',
                        },
                      })
                      currentApiKey = apiKey
                      currentApiBaseUrl = finalBaseUrl
                    }

                    const systemContent = aiSystemPrompt.trim()
                    const messages: { role: string; content: string }[] = []
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

                    openaiInstance.chat.completions
                      .create({
                        model: apiModel.trim() || 'nvidia/nemotron-3-super-120b-a12b:free',
                        messages: messages,
                      })
                      .then((completion: Record<string, any>) => {
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
      hideMarkdownPlugin,
      remConverterPlugin,
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

      {showNoteSearch &&
        (() => {
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
                        if (confirm('Delete this note?')) {
                          window.electronAPI.deleteNote(selNote.id)
                          setNotes((prev) => prev.filter((note) => note.id !== selNote.id))
                          if (currentNoteIndex >= notes.length - 1)
                            setCurrentNoteIndex(Math.max(0, notes.length - 2))
                          setShowNoteSearch(false)
                          setShowNoteActionMenu(false)
                        }
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
                    } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
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
                  } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
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
                  ref={searchInputRef}
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
                          searchInputRef.current?.focus()
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
                                if (confirm('Delete this note?')) {
                                  window.electronAPI.deleteNote(n.id)
                                  setNotes((prev) => prev.filter((note) => note.id !== n.id))
                                  if (currentNoteIndex >= notes.length - 1)
                                    setCurrentNoteIndex(Math.max(0, notes.length - 2))
                                  setShowNoteSearch(false)
                                  setShowNoteActionMenu(false)
                                }
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
        })()}

      {showMainActionMenu && (
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
            Reminders
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
      )}

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
