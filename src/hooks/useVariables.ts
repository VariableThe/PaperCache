import { useEffect } from 'react'
import * as mathjs from 'mathjs'
import { useAppStore } from '../store/useAppStore'

export function useVariables() {
  const notes = useAppStore((state) => state.notes)

  // Sync global variables whenever notes change
  useEffect(() => {
    const globals: any = {}
    const reVar = /^\/globvar\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm
    notes.forEach((note) => {
      let varMatch
      while ((varMatch = reVar.exec(note.content)) !== null) {
        const name = varMatch[1]
        try {
          globals[name] = mathjs.evaluate(varMatch[2], globals)
        } catch {
          globals[name] = varMatch[2].trim()
        }
      }
    })
    ;(window as any).__globalVariables = globals
  }, [notes])
}
