import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { CopyWidget } from './widgets'
import { isCursorInMatch, safeDecorationSet } from './pluginUtils'

export const codeBlockPlugin = ViewPlugin.fromClass(
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

      syntaxTree(view.state).iterate({
        enter: (node: SyntaxNode) => {
          if (node.type.name === 'FencedCode') {
            let lang = ''
            let code = ''
            let startCodeMark: SyntaxNode | null = null
            let endCodeMark: SyntaxNode | null = null
            let codeInfo: SyntaxNode | null = null

            let child = node.node.firstChild
            while (child) {
              if (child.type.name === 'CodeInfo') {
                lang = view.state.doc.sliceString(child.from, child.to)
                codeInfo = child
              }
              if (child.type.name === 'CodeText') {
                code = view.state.doc.sliceString(child.from, child.to)
              }
              if (child.type.name === 'CodeMark') {
                if (!startCodeMark) startCodeMark = child
                else endCodeMark = child
              }
              child = child.nextSibling
            }

            const start = node.from
            const end = node.to

            if (!isCursorInMatch(selectionRanges, start, end)) {
              if (startCodeMark) {
                const replaceTo = codeInfo ? codeInfo.to : startCodeMark.to
                decos.push({
                  from: startCodeMark.from,
                  to: replaceTo,
                  deco: Decoration.replace({}),
                })
              }
              if (endCodeMark) {
                decos.push({
                  from: endCodeMark.from,
                  to: endCodeMark.to,
                  deco: Decoration.replace({}),
                })
              }
            } else {
              if (codeInfo && !isCursorInMatch(selectionRanges, codeInfo.from, codeInfo.to)) {
                decos.push({ from: codeInfo.from, to: codeInfo.to, deco: Decoration.replace({}) })
              }
            }

            if (startCodeMark) {
              decos.push({
                from: startCodeMark.from,
                to: startCodeMark.from,
                deco: Decoration.widget({ widget: new CopyWidget(code, lang), side: 1 }),
              })
            }

            const startLine = view.state.doc.lineAt(start).number
            const endLine = view.state.doc.lineAt(end).number
            for (let i = startLine; i <= endLine; i++) {
              const line = view.state.doc.line(i)
              let className = 'cm-code-block-line'
              if (i === startLine) className += ' cm-code-block-first'
              if (i === endLine) className += ' cm-code-block-last'
              decos.push({
                from: line.from,
                to: line.from,
                deco: Decoration.line({ class: className }),
              })
            }
          }
        },
      })

      return safeDecorationSet(decos, 'codeBlockPlugin')
    }
  },
  { decorations: (v) => v.decorations }
)
