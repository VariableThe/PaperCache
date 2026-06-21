import type { EditorView } from '@codemirror/view'
import { VariableScope } from './VariableScope'

export class MathEvaluator {
  static evalTimeout: number | null = null

  static async evaluateMathChanges(
    docStr: string,
    scope: Record<string, any>
  ): Promise<{ from: number; to: number; insert: string }[]> {
    let mathjs
    try {
      mathjs = await import('mathjs')
    } catch {
      return []
    }
    const changes: { from: number; to: number; insert: string }[] = []

    // 1. Evaluate new lines that end with '=' but don't have '\u200B' yet
    const lines = docStr.split('\n')
    let offset = 0
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]
      const lineLen = text.length

      if (!text.includes('\u200B') && text.trim().endsWith('=')) {
        const expr = text.substring(0, text.lastIndexOf('=')).trim()
        if (expr && !expr.startsWith('/var') && !expr.startsWith('/globvar')) {
          try {
            const result = String(mathjs.evaluate(expr, scope))
            changes.push({
              from: offset + lineLen,
              to: offset + lineLen,
              insert: '\u200B' + result,
            })
          } catch {}
        }
      }

      offset += lineLen + 1 // +1 for '\n'
    }

    // 2. Re-evaluate existing calculations that already have '\u200B'
    const reCalc = /^(.*?=\s*)\u200B(.*)$/gm
    let calcMatch
    while ((calcMatch = reCalc.exec(docStr)) !== null) {
      const exprPart = calcMatch[1]
      const oldResult = calcMatch[2]
      const expr = exprPart.replace(/=\s*$/, '').trim()
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

    return changes
  }

  static triggerMathEvaluation(view: EditorView) {
    if (this.evalTimeout) window.clearTimeout(this.evalTimeout)
    this.evalTimeout = window.setTimeout(async () => {
      // Guard against the editor being unmounted during the timeout
      if (!view.state) return

      const docStr = view.state.doc.toString()
      const scope = VariableScope.getScope()
      const changes = await this.evaluateMathChanges(docStr, scope)

      if (changes.length > 0) {
        view.dispatch({ changes })
      }
    }, 300)
  }
}
