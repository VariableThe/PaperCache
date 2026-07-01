import type { EditorView } from '@codemirror/view'
import { describe, it, expect, vi } from 'vitest'
import { CopyWidget, CheckboxWidget, VariableWidget, ColorWidget, ImageWidget } from './widgets'

describe('Editor Widgets', () => {
  describe('CopyWidget', () => {
    it('should create DOM with correct classes', () => {
      const widget = new CopyWidget('const x = 1', 'typescript')
      const dom = widget.toDOM()

      expect(dom.tagName).toBe('SPAN')
      expect(dom.className).toBe('cm-copy-button')
      expect(dom.querySelector('.cm-code-lang')?.textContent).toBe('typescript')
      expect(dom.querySelector('svg')).not.toBeNull()
    })

    it('should check equality correctly', () => {
      const w1 = new CopyWidget('code', 'js')
      const w2 = new CopyWidget('code', 'js')
      const w3 = new CopyWidget('code2', 'js')

      expect(w1.eq(w2)).toBe(true)
      expect(w1.eq(w3)).toBe(false)
    })
  })

  describe('CheckboxWidget', () => {
    it('should create unchecked DOM correctly', () => {
      const mockView: Partial<EditorView> = { dispatch: vi.fn() }
      const widget = new CheckboxWidget(false, 10, mockView as EditorView)
      const dom = widget.toDOM()

      expect(dom.className).toBe('cm-checkbox-widget')
      expect(dom.innerHTML).toBe('')
    })

    it('should create checked DOM correctly', () => {
      const mockView: Partial<EditorView> = { dispatch: vi.fn() }
      const widget = new CheckboxWidget(true, 10, mockView as EditorView)
      const dom = widget.toDOM()

      expect(dom.className).toBe('cm-checkbox-widget cm-checkbox-checked')
      expect(dom.querySelector('svg')).not.toBeNull()
    })

    it('should dispatch correct transaction on click', () => {
      const mockView: Partial<EditorView> = { dispatch: vi.fn() }

      // Unchecked -> Checked
      const widgetUnchecked = new CheckboxWidget(false, 10, mockView as EditorView)
      const domUnchecked = widgetUnchecked.toDOM()
      domUnchecked.onclick?.({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent)

      expect(mockView.dispatch).toHaveBeenCalledWith({
        changes: { from: 10, to: 16, insert: '/checked' },
      })

      vi.clearAllMocks()

      // Checked -> Unchecked
      const widgetChecked = new CheckboxWidget(true, 10, mockView as EditorView)
      const domChecked = widgetChecked.toDOM()
      domChecked.onclick?.({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent)

      expect(mockView.dispatch).toHaveBeenCalledWith({
        changes: { from: 10, to: 18, insert: '/check' },
      })
    })
  })

  describe('VariableWidget', () => {
    it('should create DOM with correct value', () => {
      const widget = new VariableWidget('42')
      const dom = widget.toDOM()

      expect(dom.className).toBe('cm-variable-pill')
      expect(dom.textContent).toBe('42')
    })
  })

  describe('ColorWidget', () => {
    it('should create DOM with correct color style', () => {
      const widget = new ColorWidget('#ff0000')
      const dom = widget.toDOM()

      expect(dom.className).toBe('cm-color-pill')
      expect(dom.style.getPropertyValue('--pill-color')).toBe('#ff0000')
    })
  })

  describe('ImageWidget', () => {
    it('should create img element and check equality', () => {
      const w1 = new ImageWidget('/.images/test.png', 'test image')
      const w2 = new ImageWidget('/.images/test.png', 'test image')
      expect(w1.eq(w2)).toBe(true)

      const dom = w1.toDOM()
      expect(dom.className).toBe('cm-image-widget')
      expect(dom.querySelector('img')?.alt).toBe('test image')
    })
  })
})
