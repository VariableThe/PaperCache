import { ViewPlugin, Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import { ReminderWidget } from './widgets'

export const taskPlugin = ViewPlugin.fromClass(
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

        // Tasks (/task, /task-done)
        const reRem = /\/(task(?:-done)?)(?:\s+\((\d{4}-\d{2}-\d{2} \d{2}:\d{2})\))?\s+/g
        while ((match = reRem.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          const isChecked = match[1] === 'task-done'

          const line = view.state.doc.lineAt(start)
          let isOverdue = false
          const fullRe =
            /\/(task(?:-done)?)(?:\s+\((\d{4}-\d{2}-\d{2} \d{2}:\d{2})\))?\s+(.*?)(?:\s+@\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?))?[ \t]*$/
          const fullMatch = fullRe.exec(line.text)
          if (fullMatch && fullMatch[4]) {
            if (new Date(fullMatch[4]).getTime() < Date.now()) isOverdue = true
          }

          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.replace({
                widget: new ReminderWidget(isChecked, isOverdue, start, view),
              }),
            })
          } else {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({ class: 'cm-rem-highlight' }),
            })
          }

          if (line.to > end) {
            let classStr = 'cm-rem-line-text'
            if (isChecked) classStr += ' cm-checked-line-text'
            else if (isOverdue) classStr += ' cm-overdue-line-text'

            decos.push({
              from: end,
              to: line.to,
              deco: Decoration.mark({ class: classStr }),
            })
          }
        }
      }

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

export const remConverterPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.docChanged) return

      const docStr = update.state.doc.toString()
      const changes: { from: number; to: number; insert: string }[] = []

      // Match /task or /task-done followed by a space, but ONLY if not already followed by a date bracket (
      const re = /^\/(task|task-done) (?!\()/gm
      let match
      while ((match = re.exec(docStr)) !== null) {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const hh = String(now.getHours()).padStart(2, '0')
        const mins = String(now.getMinutes()).padStart(2, '0')

        const timestamp = `(${yyyy}-${mm}-${dd} ${hh}:${mins})`

        changes.push({
          from: match.index,
          to: match.index + match[0].length,
          insert: `/${match[1]} ${timestamp} `,
        })
      }

      // Match shorthand timers at the end of a task, ONLY after a space or Enter is typed
      const reShort =
        /^(\/(?:task|task-done)[^\n]*?@\s*)((?:[0-9]+[smhd])+|tmrw)([ \t]+|\n|(?:\r\n))/gm
      while ((match = reShort.exec(docStr)) !== null) {
        const now = new Date()
        const short = match[2]
        if (short === 'tmrw') {
          now.setDate(now.getDate() + 1)
          now.setHours(9, 0, 0, 0)
        } else {
          const partRe = /([0-9]+)([smhd])/g
          let partMatch
          while ((partMatch = partRe.exec(short)) !== null) {
            const val = parseInt(partMatch[1])
            const unit = partMatch[2]
            if (unit === 's') now.setSeconds(now.getSeconds() + val)
            else if (unit === 'm') now.setMinutes(now.getMinutes() + val)
            else if (unit === 'h') now.setHours(now.getHours() + val)
            else if (unit === 'd') now.setDate(now.getDate() + val)
          }
        }

        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const hh = String(now.getHours()).padStart(2, '0')
        const mins = String(now.getMinutes()).padStart(2, '0')

        const absoluteDate = `${yyyy}-${mm}-${dd} ${hh}:${mins}`

        changes.push({
          from: match.index + match[1].length,
          to: match.index + match[1].length + match[2].length,
          insert: absoluteDate,
        })
      }

      if (changes.length > 0) {
        setTimeout(() => {
          update.view.dispatch({ changes })
        }, 10)
      }
    }
  }
)
