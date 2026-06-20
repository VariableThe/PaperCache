import { ViewPlugin, Decoration, EditorView, ViewUpdate, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { ContextWidget } from './widgets'

export const markdownPlugin = ViewPlugin.fromClass(
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

      const linkRanges: { from: number; to: number }[] = []

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match

        // ==Highlight==
        const reHighlight = /==(.*?)==/g
        while ((match = reHighlight.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (start + 2 <= end - 2) {
            if (!isCursorInMatch(start, end)) {
              decos.push({ from: start, to: start + 2, deco: Decoration.replace({}) })
              decos.push({ from: end - 2, to: end, deco: Decoration.replace({}) })
            }
            decos.push({
              from: start + 2,
              to: end - 2,
              deco: Decoration.mark({ class: 'cm-custom-highlight' }),
            })
          }
        }

        // Lists
        const reList = /^(\s*)\*\s+/gm
        while ((match = reList.exec(text)) !== null) {
          const start = from + match.index + match[1].length
          const end = start + 1
          if (!isCursorInMatch(start, end + 1)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }

        // Headings
        const reHeading = /^#{1,6}\s+/gm
        while ((match = reHeading.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }

        // Links
        const reLink = /\[(.*?)\]\((.*?)\)/g
        while ((match = reLink.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          linkRanges.push({ from: start, to: end })

          const textStart = start + 1
          const textEnd = start + 1 + match[1].length
          const urlStart = textEnd
          const urlEnd = end

          let isFile = false
          let linkPath = match[2].trim()

          if (linkPath.startsWith('/file')) {
            isFile = true
            linkPath = linkPath.substring(5).trim()
          } else if (linkPath.startsWith('/url')) {
            linkPath = linkPath.substring(4).trim()
          }

          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: textStart, deco: Decoration.replace({}) })
            decos.push({ from: urlStart, to: urlEnd, deco: Decoration.replace({}) })
          }

          if (isFile) {
            decos.push({
              from: textStart,
              to: textEnd,
              deco: Decoration.mark({
                class: 'cm-custom-file-link',
                attributes: { 'data-path': linkPath, title: 'Open file: ' + linkPath },
              }),
            })
          } else {
            decos.push({
              from: textStart,
              to: textEnd,
              deco: Decoration.mark({
                class: 'cm-custom-clickable-link',
                attributes: { 'data-url': linkPath, title: linkPath },
              }),
            })
          }
        }

        // Context Command (/ctx, /context)
        const reCtx = /^\/(ctx|context)\b/gm
        while ((match = reCtx.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.replace({ widget: new ContextWidget() }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-ctx-highlight' }),
            })
          }
        }
      }

      // Traverse AST for Markdown syntax
      syntaxTree(view.state).iterate({
        enter: (node: SyntaxNode) => {
          if (node.type.name === 'EmphasisMark' || node.type.name === 'StrongMark') {
            const parent = node.node.parent
            if (parent) {
              const start = parent.from
              const end = parent.to
              if (!isCursorInMatch(start, end)) {
                decos.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              }
            }
          }

          if (node.type.name === 'HorizontalRule') {
            const start = node.from
            const end = node.to
            if (!isCursorInMatch(start, end)) {
              decos.push({
                from: start,
                to: end,
                deco: Decoration.replace({
                  widget: new (class extends WidgetType {
                    eq() {
                      return true
                    }
                    toDOM() {
                      const hr = document.createElement('hr')
                      hr.className = 'cm-hr'
                      return hr
                    }
                  })(),
                }),
              })
            }
          }
        },
      })

      try {
        const ranges = decos.map((d) => d.deco.range(d.from, d.to))
        return Decoration.set(ranges, true)
      } catch {
        return Decoration.none
      }
    }
  },
  { decorations: (v) => v.decorations }
)
