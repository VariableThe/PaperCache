import { useEffect } from 'react'

import { useAppStore } from '../store/useAppStore'
import { useVariableStore } from '../store/useVariableStore'
import { evaluate } from '../lib/evaluator'

export function useVariables() {
  const notes = useAppStore((state) => state.notes)

  // Sync global variables whenever notes change
  useEffect(() => {
    let abort = false
    async function syncVars() {
      const globals: Record<string, unknown> = {}
      const reVar = /^\/globvar\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm

      for (const note of notes) {
        let varMatch
        while ((varMatch = reVar.exec(note.content)) !== null) {
          const name = varMatch[1]
          try {
            globals[name] = evaluate(varMatch[2], globals)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`useVariables evaluation error for ${name}:`, e)
            globals[name] = varMatch[2].trim()
          }
        }
      }
      if (abort) return
      useVariableStore.getState().setGlobals(globals)
    }
    syncVars()
    return () => {
      abort = true
    }
  }, [notes])
}
