/**
 * DSL Regex Parsing Engine
 *
 * Provides a flexible, highly-performant factory for creating CodeMirror ViewPlugins
 * that match custom regex patterns in the editor and transform them into decorations
 * or trigger actions.
 *
 * Performance: Scans only `view.visibleRanges` on each update, not the full document.
 * This ensures O(visible lines) complexity instead of O(document length), keeping
 * typing completely lag-free even with many complex rules.
 */

import { ViewPlugin, ViewUpdate, EditorView, Decoration, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

export interface DSLRule {
  /**
   * The regex to match. Must NOT have the `g` flag — the engine manages global matching
   * per line internally.
   */
  regex: RegExp

  /**
   * CSS class name to apply as a mark decoration over the matched range.
   * Used for purely visual highlighting (e.g., coloring a keyword).
   * Either `className` or `widget` must be provided.
   */
  className?: string

  /**
   * Factory function to produce a WidgetType to insert BEFORE the match.
   * Either `className` or `widget` must be provided.
   */
  widget?: (match: RegExpExecArray) => WidgetType

  /**
   * Optional side-effect action to trigger when a match is found (e.g., track state).
   * This runs during the decoration-build phase; keep it pure and side-effect free
   * (avoid state mutations here as it runs on every keystroke).
   */
  onMatch?: (match: RegExpExecArray, from: number, to: number) => void
}

interface BuiltMatch {
  from: number
  to: number
  deco: Decoration
}

function buildDecorations(view: EditorView, rules: DSLRule[]) {
  const builder = new RangeSetBuilder<Decoration>()
  const matches: BuiltMatch[] = []

  // Only scan visible ranges for performance
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    for (const rule of rules) {
      // Create a new regex with the `g` flag from the rule's source
      const gre = new RegExp(
        rule.regex.source,
        rule.regex.flags.includes('g') ? rule.regex.flags : rule.regex.flags + 'g'
      )
      let match: RegExpExecArray | null

      while ((match = gre.exec(text)) !== null) {
        const matchFrom = from + match.index
        const matchTo = matchFrom + match[0].length

        if (rule.onMatch) {
          rule.onMatch(match, matchFrom, matchTo)
        }

        if (rule.widget) {
          matches.push({
            from: matchFrom,
            to: matchTo,
            deco: Decoration.widget({ widget: rule.widget(match), side: -1 }),
          })
        } else if (rule.className) {
          matches.push({
            from: matchFrom,
            to: matchTo,
            deco: Decoration.mark({ class: rule.className }),
          })
        }
      }
    }
  }

  // Sort by `from` — required by RangeSetBuilder
  matches.sort((a, b) => a.from - b.from || a.to - b.to)

  for (const m of matches) {
    builder.add(m.from, m.to, m.deco)
  }

  return builder.finish()
}

/**
 * Factory that creates a CodeMirror ViewPlugin from a set of DSL rules.
 *
 * @example
 * const myPlugin = createRegexPlugin([
 *   { regex: /\btodo\b/i, className: 'cm-todo-highlight' },
 *   { regex: /!!(\w+)/, widget: (m) => new AlertWidget(m[1]) },
 * ])
 */
export function createRegexPlugin(rules: DSLRule[]) {
  return ViewPlugin.fromClass(
    class {
      decorations

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, rules)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view, rules)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}
