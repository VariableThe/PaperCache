import { useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { ViewUpdate } from '@codemirror/view'
import { useAppStore } from '../../store/useAppStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { MathEvaluator } from './MathEvaluator'
import { useEditorExtensions } from './extensions'

export interface EditorRef {
  dispatch: (tx: any) => void
  focus: () => void
}

export const Editor = forwardRef<EditorRef>((props, ref) => {
  const notes = useAppStore((state) => state.notes)
  const setNotes = useAppStore((state) => state.setNotes)
  const currentNoteIndex = useAppStore((state) => state.currentNoteIndex)
  const activeNote = notes[currentNoteIndex] || { id: '', content: '', mtime: 0 }

  const themePreset = useSettingsStore((state) => state.themePreset)

  const editorRef = useRef<any>(null)

  useImperativeHandle(ref, () => ({
    dispatch: (tx: any) => {
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

  const extensions = useEditorExtensions(handleEditorChange)

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
