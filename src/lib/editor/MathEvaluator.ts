import type { EditorView } from '@codemirror/view'
import { getScope } from './VariableScope'
import { Parser, type Values } from 'expr-eval'

export function evaluateMath(
  docStr: string,
  scope: Record<string, unknown>
): { from: number; to: number; insert: string }[] {
  const parser = new Parser()
  const changes: { from: number; to: number; insert: string }[] = []

  // 1. Evaluate new lines that end with '=' but don't have '\u200B' yet
  const lines = docStr.split('\n')
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]
    const lineLen = text.length

    if (!text.includes('\u200B') && text.trim().endsWith('=')) {
      const fullExpr = text.substring(0, text.lastIndexOf('=')).trim()
      if (fullExpr && !fullExpr.startsWith('/var') && !fullExpr.startsWith('/globvar')) {
        let result: string | null = null
        for (let j = 0; j < fullExpr.length; j++) {
          const subExpr = fullExpr.substring(j).trim()
          if (!subExpr) continue
          try {
            result = String(parser.evaluate(subExpr, scope as Values))
            break // Found the longest valid math expression!
          } catch {
            // ignore and try next shorter substring
          }
        }

        if (result !== null) {
          changes.push({
            from: offset + lineLen,
            to: offset + lineLen,
            insert: '\u200B' + result,
          })
        }
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
    const fullExpr = exprPart.replace(/=\s*$/, '').trim()
    if (fullExpr) {
      let newResult: string | null = null
      for (let j = 0; j < fullExpr.length; j++) {
        const subExpr = fullExpr.substring(j).trim()
        if (!subExpr) continue
        try {
          newResult = String(parser.evaluate(subExpr, scope as Values))
          break
        } catch {
          // ignore and try next shorter substring
        }
      }

      if (newResult !== null && newResult !== oldResult) {
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
    }
  }

  return changes
}

export class MathEvaluator {
  static evalTimeout: number | null = null

  static triggerMathEvaluation(view: EditorView) {
    if (this.evalTimeout) window.clearTimeout(this.evalTimeout)
    this.evalTimeout = window.setTimeout(() => {
      // Guard against the editor being unmounted during the timeout
      if (!view.state) return

      const docStr = view.state.doc.toString()
      const scope = getScope()
      const changes = evaluateMath(docStr, scope)

      if (changes.length > 0) {
        view.dispatch({ changes })
      }
    }, 300)
  }
}
