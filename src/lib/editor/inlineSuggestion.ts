import { EditorState } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  WidgetType,
  ViewPlugin,
  EditorView,
  type ViewUpdate,
} from '@codemirror/view'
import { SLASH_COMMANDS } from './slashCommands'

class GhostTextWidget extends WidgetType {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    span.textContent = this.text
    span.style.color = 'rgba(128, 128, 128, 0.5)'
    span.style.pointerEvents = 'none'
    return span
  }
}

function getMatch(state: EditorState, pos: number) {
  const line = state.doc.lineAt(pos)
  const textBefore = line.text.slice(0, pos - line.from)

  const match = textBefore.match(/\/\w*$/)
  if (match) {
    const prefix = match[0]
    const matchingCommand = SLASH_COMMANDS.find(
      (c) => c.label.startsWith(prefix) && c.label !== prefix
    )
    if (matchingCommand) {
      return {
        prefix,
        command: matchingCommand,
        from: pos - prefix.length,
        to: pos,
      }
    }
  }
  return null
}

export const ghostTextPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.getDeco(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = this.getDeco(update.view)
      }
    }

    getDeco(view: EditorView) {
      const pos = view.state.selection.main.head
      if (!view.state.selection.main.empty) return Decoration.none

      const match = getMatch(view.state, pos)
      if (match) {
        const remainingText = match.command.label.slice(match.prefix.length)
        const deco = Decoration.widget({
          widget: new GhostTextWidget(remainingText),
          side: 1,
        })
        return Decoration.set([deco.range(pos)])
      }
      return Decoration.none
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

export const acceptGhostTextCommand = (view: EditorView) => {
  const pos = view.state.selection.main.head
  if (!view.state.selection.main.empty) return false
  const match = getMatch(view.state, pos)
  if (match) {
    view.dispatch({
      changes: { from: match.from, to: match.to, insert: match.command.apply },
      selection: { anchor: match.from + match.command.apply.length },
    })
    return true
  }
  return false
}
