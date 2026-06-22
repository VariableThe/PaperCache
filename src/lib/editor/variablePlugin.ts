import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import { VariableWidget } from './widgets'
import { scopeChangedEffect, getScope } from './VariableScope'

export const variablePlugin = ViewPlugin.fromClass(
  class {
    decorations

    constructor(view: EditorView) {
      this.decorations = this.buildDeco(view)
    }

    update(update: ViewUpdate) {
      const scopeChanged = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(scopeChangedEffect))
      )
      if (update.docChanged || update.viewportChanged || update.selectionSet || scopeChanged) {
        this.decorations = this.buildDeco(update.view)
      }
    }

    buildDeco(view: EditorView) {
      const decos: { from: number; to: number; deco: Decoration }[] = []
      const selectionRanges = view.state.selection.ranges
      const isCursorInMatch = (start: number, end: number) => {
        return selectionRanges.some(
          (r: { from: number; to: number }) => r.from <= end && r.to >= start
        )
      }

      const scope = getScope()
      const scopeKeys = Object.keys(scope).sort((a, b) => b.length - a.length)

      if (scopeKeys.length === 0) return Decoration.none

      const escapeRegex = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedKeys = scopeKeys.map(escapeRegex)
      const reKeys = new RegExp(`\\b(${escapedKeys.join('|')})\\b`, 'g')

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match

        while ((match = reKeys.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          const line = view.state.doc.lineAt(start)

          if (line.text.trim().startsWith('/var') || line.text.trim().startsWith('/globvar'))
            continue

          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.replace({ widget: new VariableWidget(String(scope[match[1]])) }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-variable-highlight' }),
            })
          }
        }
      }

      try {
        const ranges = decos.map((d) => d.deco.range(d.from, d.to))
        return Decoration.set(ranges, true)
      } catch (e) {
        console.error('variablePlugin error:', e)
        return Decoration.none
      }
    }
  },
  { decorations: (v) => v.decorations }
)
