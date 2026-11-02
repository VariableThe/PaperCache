import { useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { ViewUpdate } from '@codemirror/view'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useDebouncedSave } from '../hooks/useDebouncedSave'

import { useEditorExtensions } from '../lib/editor/extensions'
import { MathEvaluator } from '../lib/editor/MathEvaluator'
import { type TransactionSpec } from '@codemirror/state'
const SAVE_DEBOUNCE_MS = 500

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
  const setIsEditorDirty = useAppStore((state) => state.setIsEditorDirty)
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

  const { schedule, flush } = useDebouncedSave<{ id: string; content: string }>(
    ({ id, content }) => {
      window.electronAPI.saveNote(id, content)
      setIsEditorDirty(false)
    },
    SAVE_DEBOUNCE_MS
  )

  const handleEditorChange = useCallback(
    (val: string, viewUpdate?: ViewUpdate) => {
      if (activeNote.id) {
        setIsEditorDirty(true)
        schedule({ id: activeNote.id, content: val })
      }

      setNotes((prevNotes) => {
        const updatedNotes = [...prevNotes]
        if (updatedNotes[currentNoteIndex]) {
          updatedNotes[currentNoteIndex] = {
            ...updatedNotes[currentNoteIndex],
            content: val,
          }
        }
        return updatedNotes
      })

      if (viewUpdate?.transactions?.some((tr) => tr.docChanged)) {
        if (editorRef.current?.view) {
          const view = editorRef.current.view
          MathEvaluator.triggerMathEvaluation(view)
        }
      }
    },
    [activeNote.id, currentNoteIndex, setNotes, schedule, setIsEditorDirty]
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

  useEffect(() => {
    return () => {
      // Flush (not drop) any pending debounced save when the active note
      // changes, so edits made within the debounce window are never lost.
      flush()
    }
  }, [currentNoteIndex, flush])

  useEffect(() => {
    if (editorRef.current?.view) {
      MathEvaluator.triggerMathEvaluation(editorRef.current.view)
    }
  }, [activeNote.id])

  useEffect(() => {
    document.querySelector('.editor-container')?.scrollTo(0, 0)
    document.querySelector('.cm-scroller')?.scrollTo(0, 0)
  }, [activeNote.id])

  return (
    <div className="editor-container">
      <CodeMirror
        key={activeNote.id}
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
