import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import { ColorWidget } from './widgets'

export const formatPlugin = ViewPlugin.fromClass(
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

        // Color Formats
        const reColor = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
        while ((match = reColor.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.replace({ widget: new ColorWidget(match[0]) }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({
                class: 'cm-color-highlight',
                attributes: { style: `--pill-color: ${match[0]}` },
              }),
            })
          }
        }

        // Date Formats (YYYY-MM-DD or DD-MM-YYYY)
        const reDate = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\b/g
        while ((match = reDate.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-date-pill' }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-date-highlight' }),
            })
          }
        }

        // Time Formats (HH:MM or HH:MM:SS)
        const reTime = /\b\d{2}:\d{2}(?::\d{2})?\b/g
        while ((match = reTime.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-time-pill' }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-time-highlight' }),
            })
          }
        }

        // Currency Formats
        const reCurrency = /[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d{1,2})?/g
        while ((match = reCurrency.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-currency-pill' }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-currency-highlight' }),
            })
          }
        }

        // Tags (!tag)
        const reTag = /![a-zA-Z0-9_-]+/g
        while ((match = reTag.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-tag-pill' }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-tag-highlight' }),
            })
          }
        }
      }

      try {
        const ranges = decos.map((d) => d.deco.range(d.from, d.to))
        return Decoration.set(ranges, true)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('formatPlugin error:', e)
        return Decoration.none
      }
    }
  },
  { decorations: (v) => v.decorations }
)
