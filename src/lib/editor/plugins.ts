import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view'
import { numberMatcher, symbolMatcher, aiMatcher, mathMatcher } from './matchers'
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

export const aiPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) {
      this.decorations = aiMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = aiMatcher.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations }
)

export const mathPlugin = ViewPlugin.fromClass(
  class {
    decorations
    constructor(view: EditorView) {
      this.decorations = mathMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = mathMatcher.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations }
)

export const scopeUpdaterPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (update.docChanged) {
        VariableScope.triggerScopeUpdate(update.state.doc.toString(), update.view)
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
