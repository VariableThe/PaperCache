import { useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { ViewUpdate } from '@codemirror/view'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'

import { useEditorExtensions } from '../lib/editor/extensions'

import { type TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface EditorRef {
  dispatch: (tx: TransactionSpec) => void
  focus: () => void
  view?: EditorView
}

export const Editor = forwardRef<EditorRef>((_props, ref) => {
  const notes = useAppStore((state) => state.notes)
  const setNotes = useAppStore((state) => state.setNotes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const activeNote = notes[currentNoteIndex] || { id: '', content: '', mtime: 0 }

  const themePreset = useSettingsStore((state) => state.themePreset)

  const editorRef = useRef<EditorRef>(null)

  useImperativeHandle(ref, () => ({
    dispatch: (tx: TransactionSpec) => {
      if (editorRef.current?.view) {
        editorRef.current.view.dispatch(tx)
      }
    },
    focus: () => {
      if (editorRef.current?.view) {
        editorRef.current.view.focus()
      }
    },
  }))

  const handleEditorChange = useCallback(
    (val: string, viewUpdate?: ViewUpdate) => {
      setNotes((prevNotes) => {
        const updatedNotes = [...prevNotes]
        if (updatedNotes[currentNoteIndex]) {
          updatedNotes[currentNoteIndex] = {
            ...updatedNotes[currentNoteIndex],
            content: val,
          }
          window.electronAPI.saveNote(updatedNotes[currentNoteIndex].id, val)
        }
        return updatedNotes
      })

      if (viewUpdate?.transactions?.some((tr) => tr.docChanged)) {
        if (editorRef.current?.view) {
          const view = editorRef.current.view
          import('../lib/editor/MathEvaluator').then((m) => {
            m.MathEvaluator.triggerMathEvaluation(view)
          })
        }
      }
    },
    [currentNoteIndex, setNotes]
  )

  const extensions = useEditorExtensions()

  useEffect(() => {
    const handleWindowFocus = () => {
      if (editorRef.current?.view && !editorRef.current.view.hasFocus) {
        editorRef.current.view.focus()
      }
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  return (
    <div className="editor-container">
      <CodeMirror
        ref={editorRef}
        value={activeNote.content}
        onChange={handleEditorChange}
        extensions={extensions}
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
  )
})
