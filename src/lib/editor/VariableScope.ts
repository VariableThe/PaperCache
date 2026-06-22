import type { EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'
import { useVariableStore } from '../../store/useVariableStore'
import { Parser } from 'expr-eval'
import { MathEvaluator } from './MathEvaluator'

export const scopeChangedEffect = StateEffect.define<void>()

export class VariableScope {
  lastDocString = ''
  scopeEvalTimeout: number | null = null
  scopeVersion = 0

  triggerScopeUpdate(docStr: string, view: EditorView | null) {
    if (docStr === this.lastDocString) return
    this.lastDocString = docStr
    if (this.scopeEvalTimeout) window.clearTimeout(this.scopeEvalTimeout)
    this.scopeVersion++
    const currentVersion = this.scopeVersion
    this.scopeEvalTimeout = window.setTimeout(() => {
      const newScope: Record<string, unknown> = {}
      const reVar = /^\/var\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm
      let varMatch
      let changed = false

      const globalVars = useVariableStore.getState().getGlobals() || {}
      const parser = new Parser()

      while ((varMatch = reVar.exec(docStr)) !== null) {
        const name = varMatch[1]
        try {
          const mergedScope = Object.assign({}, globalVars, newScope)
          const val = parser.evaluate(varMatch[2], mergedScope as Record<string, unknown>)
          newScope[name] = val
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`VariableScope evaluation error for ${name}:`, e)
          newScope[name] = varMatch[2].trim()
        }

        const currentNoteScope = useVariableStore.getState().getNoteScope()
        if (currentNoteScope[name] !== newScope[name]) {
          changed = true
        }
      }

      if (currentVersion !== this.scopeVersion) return

      const currentNoteScope = useVariableStore.getState().getNoteScope()
      if (changed || Object.keys(currentNoteScope).length !== Object.keys(newScope).length) {
        useVariableStore.getState().setNoteScope(newScope)
        if (view) {
          view.dispatch({ effects: [scopeChangedEffect.of()] })
          MathEvaluator.triggerMathEvaluation(view)
        }
      }
    }, 300)
  }
}

export function getScope(): Record<string, unknown> {
  const globalVars = useVariableStore.getState().getGlobals() || {}
  const noteScope = useVariableStore.getState().getNoteScope() || {}
  return Object.assign({}, globalVars, noteScope)
}
