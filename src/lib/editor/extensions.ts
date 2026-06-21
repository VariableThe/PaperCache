import { useMemo } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { search } from '@codemirror/search'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { insertTab, indentLess } from '@codemirror/commands'

import { mdHighlighting } from './matchers'
import { numberPlugin, symbolPlugin, aiPlugin, mathPlugin, decomposedPlugins } from './plugins'
import { useAIStore } from '../../store/useAIStore'
import { useAppStore, type Note } from '../../store/useAppStore'

const handleDeleteNote = () => {
  const note = useAppStore.getState().notes[useAppStore.getState().currentNoteIndex]
  if (note) {
    if (note.id.startsWith('commands/')) {
      alert('Files in the commands folder cannot be deleted.')
      return true
    }
    if (confirm('Delete this note?')) {
      window.electronAPI.deleteNote(note.id)
      useAppStore.getState().setNotes((prev: Note[]) => prev.filter((n: Note) => n.id !== note.id))
      if (useAppStore.getState().currentNoteIndex >= useAppStore.getState().notes.length - 1)
        useAppStore
          .getState()
          .setCurrentNoteIndex(Math.max(0, useAppStore.getState().notes.length - 2))
    }
  }
  return true
}

export function useEditorExtensions() {
  const { apiBaseUrl, apiModel, aiSystemPrompt } = useAIStore()

  return useMemo(
    () => [
      EditorView.lineWrapping,
      Prec.highest(
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
            run: () => handleDeleteNote(),
          },
          {
            key: 'Mod-Delete',
            run: () => handleDeleteNote(),
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

                const thinkingText = '\n\u200B...\u200C\n'
                view.dispatch({ changes: { from: line.to, insert: thinkingText } })
                ;(async () => {
                  try {
                    const isKeySet = await window.electronAPI.getApiKeyStatus()
                    if (!isKeySet) {
                      view.dispatch({
                        changes: {
                          from: line.to,
                          to: line.to + thinkingText.length,
                          insert: '\n\u200BError - Set your OpenAI API key in settings\u200C\n',
                        },
                      })
                      return
                    }

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
                        baseURL: finalBaseUrl || '',
                      })
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

                        view.dispatch({
                          changes: {
                            from: line.to,
                            to: line.to + thinkingText.length,
                            insert: '\n\u200B' + response + '\u200C\n',
                          },
                        })
                      })
                      .catch((error) => {
                        view.dispatch({
                          changes: {
                            from: line.to,
                            to: line.to + thinkingText.length,
                            insert: '\n\u200BError - ' + error.message + '\u200C\n',
                          },
                        })
                      })
                  } catch (err: unknown) {
                    view.dispatch({
                      changes: {
                        from: line.to,
                        to: line.to + thinkingText.length,
                        insert:
                          '\n\u200BSetup Error - ' +
                          ((err as Error).message || String(err)) +
                          '\u200C\n',
                      },
                    })
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
    [apiBaseUrl, apiModel, aiSystemPrompt]
  )
}
