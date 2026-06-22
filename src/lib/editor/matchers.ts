import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { MatchDecorator, Decoration } from '@codemirror/view'

export const mdHighlighting = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: t.heading2, fontSize: '1.2em', fontWeight: 'bold' },
  { tag: t.heading3, fontSize: '1.1em', fontWeight: 'bold' },
  { tag: t.heading4, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.heading5, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.heading6, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#3b82f6', textDecoration: 'underline' },
  { tag: t.url, color: '#3b82f6' },
  { tag: t.processingInstruction, color: 'rgba(128,128,128,0.5)' },
  { tag: t.meta, color: 'rgba(128,128,128,0.5)' },
  { tag: t.punctuation, color: 'rgba(128,128,128,0.5)' },
])

// Custom Decorators for syntax highlighting
export const numberMatcher = new MatchDecorator({
  regexp: /\b\d+(\.\d+)?\b/g,
  decoration: Decoration.mark({ class: 'cm-custom-number' }),
})

export const symbolMatcher = new MatchDecorator({
  regexp: /[+\-*/=^()]/g,
  decoration: Decoration.mark({ class: 'cm-custom-symbol' }),
})
