import type { EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'

export const scopeChangedEffect = StateEffect.define<void>()

export class VariableScope {
  static globalScopeCache: Record<string, unknown> = {}
  static lastDocString = ''
  static scopeEvalTimeout: number | null = null
  static scopeVersion = 0

  static triggerScopeUpdate(docStr: string, view: EditorView | null) {
    if (docStr === this.lastDocString) return
    this.lastDocString = docStr
    if (this.scopeEvalTimeout) window.clearTimeout(this.scopeEvalTimeout)
    this.scopeVersion++
    const currentVersion = this.scopeVersion
    this.scopeEvalTimeout = window.setTimeout(async () => {
      let mathjs
      try {
        mathjs = await import('mathjs')
      } catch {
        return
      }

      const newScope: Record<string, unknown> = {}
      const reVar = /^\/var\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm
      let varMatch
      let changed = false

      const globalVars =
        (window as unknown as { __globalVariables: Record<string, unknown> }).__globalVariables ||
        {}

      while ((varMatch = reVar.exec(docStr)) !== null) {
        const name = varMatch[1]
        try {
          const val = mathjs.evaluate(varMatch[2], Object.assign({}, globalVars, newScope))
          newScope[name] = val
        } catch {
          newScope[name] = varMatch[2].trim()
        }
        if (this.globalScopeCache[name] !== newScope[name]) {
          changed = true
        }
      }

      if (currentVersion !== this.scopeVersion) return
      if (changed || Object.keys(this.globalScopeCache).length !== Object.keys(newScope).length) {
        this.globalScopeCache = newScope
        if (view) {
          view.dispatch({ effects: [scopeChangedEffect.of()] })
          import('./MathEvaluator').then((m) => m.MathEvaluator.triggerMathEvaluation(view))
        }
      }
    }, 300)
  }

  static getScope(): Record<string, unknown> {
    const globalVars =
      (window as unknown as { __globalVariables: Record<string, unknown> }).__globalVariables || {}
    return Object.assign({}, globalVars, this.globalScopeCache)
  }
}
