import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import { CheckboxWidget } from './widgets'

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
      const isCursorInMatch = (start: number, end: number) => {
        return selectionRanges.some(
          (r: { from: number; to: number }) => r.from <= end && r.to >= start
        )
      }

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match

        // Checkboxes (/check, /checked)
        const reCheck = /\/(check(?:ed)?)\b/g
        while ((match = reCheck.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          const isChecked = match[1] === 'checked'

          if (!isCursorInMatch(start, end)) {
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

      try {
        const ranges = decos.map((d) => d.deco.range(d.from, d.to))
        return Decoration.set(ranges, true)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('checkboxPlugin error:', e)
        return Decoration.none
      }
    }
  },
  { decorations: (v) => v.decorations }
)
