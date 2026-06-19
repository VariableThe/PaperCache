import { ViewPlugin, Decoration, EditorView, ViewUpdate, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import * as mathjs from 'mathjs'
import { numberMatcher, symbolMatcher, aiMatcher, mathMatcher } from './matchers'
import { CopyWidget, CheckboxWidget, VariableWidget, ReminderWidget } from './widgets'

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

export const hideMarkdownPlugin = ViewPlugin.fromClass(
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
        return selectionRanges.some((r: any) => r.from <= end && r.to >= start)
      }

      const linkRanges: { from: number; to: number }[] = []
      const fullDoc = view.state.doc.toString()

      // Build variable scope (incorporate global variables)
      const scope: any = Object.assign({}, (window as any).__globalVariables || {})
      const reVar = /^\/var\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/gm
      let varMatch
      while ((varMatch = reVar.exec(fullDoc)) !== null) {
        const name = varMatch[1]
        try {
          scope[name] = mathjs.evaluate(varMatch[2], scope)
        } catch {
          scope[name] = varMatch[2].trim()
        }
      }
      const scopeKeys = Object.keys(scope).sort((a, b) => b.length - a.length)

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)

        const reHighlight = /==(.*?)==/g
        let match
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

        const reList = /^(\s*)\*\s+/gm
        while ((match = reList.exec(text)) !== null) {
          const start = from + match.index + match[1].length
          const end = start + 1 // only the asterisk
          if (!isCursorInMatch(start, end + 1)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }

        // Handled by syntaxTree below

        const reHeading = /^#{1,6}\s+/gm
        while ((match = reHeading.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: end, deco: Decoration.replace({}) })
          }
        }

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

        const reFile = /\/file\s+([^\s)\]]+)/g
        while ((match = reFile.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length

          if (linkRanges.some((r) => r.from <= start && r.to >= end)) continue

          const pathStart = start + match[0].indexOf(match[1])

          if (!isCursorInMatch(start, end)) {
            decos.push({ from: start, to: pathStart, deco: Decoration.replace({}) })
          }

          decos.push({
            from: pathStart,
            to: end,
            deco: Decoration.mark({
              class: 'cm-custom-file-link',
              attributes: { 'data-path': match[1], title: 'Open file: ' + match[1] },
            }),
          })
        }

        // Variable rendering
        if (scopeKeys.length > 0) {
          const reKeys = new RegExp(`\\b(${scopeKeys.join('|')})\\b`, 'g')
          while ((match = reKeys.exec(text)) !== null) {
            const start = from + match.index
            const end = start + match[0].length
            const line = view.state.doc.lineAt(start)
            if (line.text.trim().startsWith('/var')) continue // don't replace inside variable definitions!

            if (!isCursorInMatch(start, end)) {
              decos.push({
                from: start,
                to: end,
                deco: Decoration.replace({ widget: new VariableWidget(scope[match[1]]) }),
              })
            } else {
              decos.push({
                from: start,
                to: end,
                deco: Decoration.mark({ class: 'cm-variable-highlight' }),
              })
            }
          }
        }

        // Color Formats
        const reColor = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
        while ((match = reColor.exec(text)) !== null) {
          const start = from + match.index
          const end = start + match[0].length
          if (!isCursorInMatch(start, end)) {
            decos.push({
              from: start,
              to: end,
              deco: Decoration.mark({
                class: 'cm-color-pill',
                attributes: { style: `--pill-color: ${match[0]}` },
              }),
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

        // Date Formats (YYYY-MM-DD)
        const reDate = /\b\d{4}-\d{2}-\d{2}\b/g
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
      } // end of visibleRanges iteration

      // Traverse AST for Code Blocks
      syntaxTree(view.state).iterate({
        enter: (node) => {
          if (node.type.name === 'FencedCode') {
            let lang = ''
            let code = ''
            let startCodeMark: any = null
            let endCodeMark: any = null
            let codeInfo: any = null

            let child = node.node.firstChild
            while (child) {
              if (child.type.name === 'CodeInfo') {
                lang = view.state.doc.sliceString(child.from, child.to)
                codeInfo = child
              }
              if (child.type.name === 'CodeText')
                code = view.state.doc.sliceString(child.from, child.to)
              if (child.type.name === 'CodeMark') {
                if (!startCodeMark) startCodeMark = child
                else endCodeMark = child
              }
              child = child.nextSibling
            }

            const start = node.from
            const end = node.to

            if (!isCursorInMatch(start, end)) {
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
              if (codeInfo && !isCursorInMatch(codeInfo.from, codeInfo.to)) {
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
        console.error('Decoration builder error:', e)
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

        // Push the change to replace ONLY the shorthand part
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
