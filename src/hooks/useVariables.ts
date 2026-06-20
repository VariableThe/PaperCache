import { useEffect } from 'react'

import { useAppStore } from '../store/useAppStore'

export function useVariables() {
  const notes = useAppStore((state) => state.notes)

  // Sync global variables whenever notes change
  useEffect(() => {
    let abort = false
    async function syncVars() {
      const globals: Record<string, unknown> = {}
      const reVar = /^\/globvar\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm

      let mathjs: { evaluate: (e: string, s: unknown) => unknown } | null = null

      for (const note of notes) {
        let varMatch
        while ((varMatch = reVar.exec(note.content)) !== null) {
          const name = varMatch[1]
          try {
            if (!mathjs) {
              mathjs = await import('mathjs')
            }
            globals[name] = mathjs.evaluate(varMatch[2], globals)
          } catch {
            globals[name] = varMatch[2].trim()
          }
        }
      }
      if (abort) return
      ;(window as unknown as { __globalVariables: Record<string, unknown> }).__globalVariables =
        globals
    }
    syncVars()
    return () => {
      abort = true
    }
  }, [notes])
}
