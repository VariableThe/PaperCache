import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import { CheckboxWidget } from './widgets'
import { isCursorInMatch, safeDecorationSet } from './pluginUtils'

const reCheck = /\/(check(?:ed)?)\b/g

export const checkboxPlugin = ViewPlugin.fromClass(
  class {
    decorations

    constructor(view: EditorView) {
      this.decorations = this.buildDeco(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDeco(update.view)
      }
    }

    buildDeco(view: EditorView) {
      const decos: { from: number; to: number; deco: Decoration }[] = []
      const selectionRanges = view.state.selection.ranges

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match

        reCheck.lastIndex = 0
        while ((match = reCheck.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          const isChecked = match[1] === 'checked'

          if (!isCursorInMatch(selectionRanges, start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.replace({ widget: new CheckboxWidget(isChecked, start, view) }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-check-highlight' }),
            })
          }

          if (isChecked) {
            const line = view.state.doc.lineAt(start)
            if (line.to > end) {
              decos.push({
                from: end,
                to: line.to,
                deco: Decoration.mark({ class: 'cm-checked-line-text' }),
              })
            }
          }
        }
      }

      return safeDecorationSet(decos, 'checkboxPlugin')
    }
  },
  { decorations: (v) => v.decorations }
)
