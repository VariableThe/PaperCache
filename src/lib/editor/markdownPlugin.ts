import { ViewPlugin, Decoration, EditorView, ViewUpdate, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { ContextWidget, ImageWidget } from './widgets'
import { isCursorInMatch, safeDecorationSet } from './pluginUtils'

const reImage = /!\[(.*?)\]\((.*?)\)/g
const reHighlight = /==(.*?)==/g
const reList = /^(\s*)\*\s+/gm
const reHeading = /^#{1,6}\s+/gm
const reLink = /\[(.*?)\]\((.*?)\)/g
const reCtx = /^\/(ctx|context)\b/gm

class HrWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-hr'
    return hr
  }
}

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
      const linkRanges: { from: number; to: number }[] = []

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let match

        // Image / Audio Embeds (![alt](path))
        reImage.lastIndex = 0
        while ((match = reImage.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          linkRanges.push({ from: start, to: end })

          const altText = match[1]!
          const assetPath = match[2]!.trim()

          if (!isCursorInMatch(selectionRanges, start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.replace({
                widget: new ImageWidget(assetPath, altText),
              }),
            })
          }
        }

        // ==Highlight==
        reHighlight.lastIndex = 0
        while ((match = reHighlight.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (start + 2 <= end - 2) {
            if (!isCursorInMatch(selectionRanges, start, end)) {
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
        reList.lastIndex = 0
        while ((match = reList.exec(text)) !== null) {
          const start = from + match.index + match[1]!.length
          const end = start + 1
          if (!isCursorInMatch(selectionRanges, start, end + 1)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }

        // Headings
        reHeading.lastIndex = 0
        while ((match = reHeading.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }

        // Links
        reLink.lastIndex = 0
        while ((match = reLink.exec(text)) !== null) {
          const start = from + match.index
          if (start > 0 && view.state.doc.sliceString(start - 1, start) === '!') {
            continue
          }
          const end = start + match[0].length
          linkRanges.push({ from: start, to: end })

          const textStart = start + 1
          const textEnd = start + 1 + match[1]!.length
          const urlStart = textEnd
          const urlEnd = end

          let isFile = false
          let linkPath = match[2]!.trim()

          if (linkPath.startsWith('/file')) {
            isFile = true
            linkPath = linkPath.substring(5).trim().replace(/\\/g, '/')
          } else if (linkPath.startsWith('/url')) {
            linkPath = linkPath.substring(4).trim()
          }

          if (!isCursorInMatch(selectionRanges, start, end)) {
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
        reCtx.lastIndex = 0
        while ((match = reCtx.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(selectionRanges, start, end)) {
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
              if (!isCursorInMatch(selectionRanges, start, end)) {
                decos.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              }
            }
          }

          if (node.type.name === 'HorizontalRule') {
            const start = node.from
            const end = node.to
            if (!isCursorInMatch(selectionRanges, start, end)) {
              decos.push({
                from: start,
                to: end,
                deco: Decoration.replace({
                  widget: new HrWidget(),
                }),
              })
            }
          }
        },
      })

      return safeDecorationSet(decos, 'markdownPlugin')
    }
  },
  { decorations: (v) => v.decorations }
)
