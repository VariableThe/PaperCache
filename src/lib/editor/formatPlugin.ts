import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import { ColorWidget } from './widgets'
import { isCursorInMatch, safeDecorationSet } from './pluginUtils'

const reColor = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const reDate = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\b/g
const reTime = /\b\d{2}:\d{2}(?::\d{2})?\b/g
const reCurrency = /[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d{1,2})?/g
const reTag = /![a-zA-Z0-9_-]+/g

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

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match

        // Color Formats
        reColor.lastIndex = 0
        while ((match = reColor.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
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
        reDate.lastIndex = 0
        while ((match = reDate.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
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
        reTime.lastIndex = 0
        while ((match = reTime.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
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
        reCurrency.lastIndex = 0
        while ((match = reCurrency.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
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
        reTag.lastIndex = 0
        while ((match = reTag.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
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

      return safeDecorationSet(decos, 'formatPlugin')
    }
  },
  { decorations: (v) => v.decorations }
)
