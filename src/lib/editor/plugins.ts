import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view'
import { numberMatcher, symbolMatcher } from './matchers'
import { variablePlugin } from './variablePlugin'
import { formatPlugin } from './formatPlugin'
import { checkboxPlugin } from './checkboxPlugin'
import { taskPlugin, remConverterPlugin } from './taskPlugin'
import { markdownPlugin } from './markdownPlugin'
import { codeBlockPlugin } from './codeBlockPlugin'
import { VariableScope } from './VariableScope'

export const numberPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) {
      this.decorations = numberMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = numberMatcher.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations }
)

export const symbolPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) {
      this.decorations = symbolMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = symbolMatcher.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations }
)

import { Decoration } from '@codemirror/view'
import { safeDecorationSet } from './pluginUtils'

const reAi = /\u200B[^\u200B]*?\u200C/g
const reMath = /\u200B[^\n]*/g

export const aiPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) {
      this.decorations = this.buildDeco(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDeco(update.view)
      }
    }
    buildDeco(view: EditorView) {
      const decos: { from: number; to: number; deco: Decoration }[] = []
      const docStr = view.state.doc.toString()
      reAi.lastIndex = 0
      let match
      while ((match = reAi.exec(docStr)) !== null) {
        decos.push({
          from: match.index,
          to: match.index + match[0].length,
          deco: Decoration.mark({ class: 'cm-custom-ai' }),
        })
      }
      return safeDecorationSet(decos, 'aiPlugin')
    }
  },
  { decorations: (v) => v.decorations }
)

export const mathPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) {
      this.decorations = this.buildDeco(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDeco(update.view)
      }
    }
    buildDeco(view: EditorView) {
      const decos: { from: number; to: number; deco: Decoration }[] = []
      const docStr = view.state.doc.toString()
      reMath.lastIndex = 0
      let match
      while ((match = reMath.exec(docStr)) !== null) {
        const textAfter = docStr.slice(match.index + 1)
        const nextB = textAfter.indexOf('\u200B')
        const nextC = textAfter.indexOf('\u200C')

        const isAI = nextC !== -1 && (nextB === -1 || nextC < nextB)

        if (!isAI) {
          decos.push({
            from: match.index,
            to: match.index + match[0].length,
            deco: Decoration.mark({ class: 'cm-custom-math' }),
          })
        }
      }
      return safeDecorationSet(decos, 'mathPlugin')
    }
  },
  { decorations: (v) => v.decorations }
)

export const scopeUpdaterPlugin = ViewPlugin.fromClass(
  class {
    scope = new VariableScope()
    constructor(view: EditorView) {
      this.scope.triggerScopeUpdate(view.state.doc.toString(), view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.scope.triggerScopeUpdate(update.state.doc.toString(), update.view)
      }
    }
  }
)

export const decomposedPlugins = [
  variablePlugin,
  formatPlugin,
  checkboxPlugin,
  taskPlugin,
  markdownPlugin,
  codeBlockPlugin,
  remConverterPlugin,
  scopeUpdaterPlugin,
]
