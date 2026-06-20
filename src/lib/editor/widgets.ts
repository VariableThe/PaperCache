import { WidgetType, EditorView } from '@codemirror/view'

export class CopyWidget extends WidgetType {
  code: string
  language: string
  constructor(code: string, language: string) {
    super()
    this.code = code
    this.language = language
  }

  eq(other: CopyWidget) {
    return other.code === this.code && other.language === this.language
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.setAttribute('aria-hidden', 'true')
    wrap.className = 'cm-copy-button'
    wrap.title = 'Copy code'

    if (this.language) {
      const langSpan = document.createElement('sup')
      langSpan.textContent = this.language
      langSpan.className = 'cm-code-lang'
      wrap.appendChild(langSpan)
    }

    const iconSpan = document.createElement('span')
    // Standard copy icon (two offset rounded rectangles)
    iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
    wrap.appendChild(iconSpan)

    wrap.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      navigator.clipboard.writeText(this.code)
      const originalHtml = iconSpan.innerHTML
      // Checkmark icon
      iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      setTimeout(() => {
        iconSpan.innerHTML = originalHtml
      }, 2000)
    }
    return wrap
  }
}

export class CheckboxWidget extends WidgetType {
  checked: boolean
  pos: number
  view: EditorView

  constructor(checked: boolean, pos: number, view: EditorView) {
    super()
    this.checked = checked
    this.pos = pos
    this.view = view
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-checkbox-widget' + (this.checked ? ' cm-checkbox-checked' : '')

    if (this.checked) {
      wrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    } else {
      wrap.innerHTML = `` // empty for unchecked, border provides the box
    }

    wrap.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const from = this.pos
      const to = this.pos + (this.checked ? 8 : 6) // length of "/checked" or "/check"
      const insert = this.checked ? '/check' : '/checked'
      this.view.dispatch({
        changes: { from, to, insert },
      })
    }

    return wrap
  }
}

export class VariableWidget extends WidgetType {
  value: string
  constructor(value: string) {
    super()
    this.value = value
  }
  eq(other: VariableWidget) {
    return other.value === this.value
  }
  toDOM() {
    const span = document.createElement('span')
    span.textContent = String(this.value)
    span.className = 'cm-variable-pill'
    return span
  }
}

export class ColorWidget extends WidgetType {
  color: string
  constructor(color: string) {
    super()
    this.color = color
  }
  eq(other: ColorWidget) {
    return other.color === this.color
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-color-pill'
    span.style.setProperty('--pill-color', this.color)

    const circle = document.createElement('span')
    circle.className = 'cm-color-circle'
    circle.style.backgroundColor = this.color
    circle.style.width = '10px'
    circle.style.height = '10px'
    circle.style.borderRadius = '50%'
    circle.style.display = 'inline-block'
    circle.style.marginRight = '4px'
    circle.style.cursor = 'pointer'
    circle.title = 'Copy hex code'

    circle.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      navigator.clipboard.writeText(this.color)

      span.classList.remove('flash')
      void span.offsetWidth // Trigger reflow to restart animation if clicked quickly
      span.classList.add('flash')

      setTimeout(() => {
        span.classList.remove('flash')
      }, 500)
    }

    const text = document.createTextNode(this.color)

    span.appendChild(circle)
    span.appendChild(text)

    return span
  }
}

export class ReminderWidget extends WidgetType {
  checked: boolean
  overdue: boolean
  pos: number
  view: EditorView

  constructor(checked: boolean, overdue: boolean, pos: number, view: EditorView) {
    super()
    this.checked = checked
    this.overdue = overdue
    this.pos = pos
    this.view = view
  }

  eq(other: ReminderWidget) {
    return (
      other.checked === this.checked && other.pos === this.pos && other.overdue === this.overdue
    )
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className =
      'cm-rem-widget' +
      (this.checked ? ' cm-rem-checked' : '') +
      (this.overdue && !this.checked ? ' cm-rem-overdue' : '')

    if (this.checked) {
      wrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="8"></circle></svg>`
    } else {
      wrap.innerHTML = `` // empty for unchecked, border provides the box
    }

    // Use onmousedown to prevent CodeMirror from interfering with selection
    wrap.onmousedown = (e) => {
      e.preventDefault()
      e.stopPropagation()

      const from = this.pos
      const to = this.pos + (this.checked ? 10 : 5) // length of "/task-done" or "/task"
      const insert = this.checked ? '/task' : '/task-done'

      this.view.dispatch({
        changes: { from, to, insert },
      })
    }

    return wrap
  }

  ignoreEvent() {
    return true
  }
}

export class ContextWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.textContent = 'Context Attached'
    span.className = 'cm-ctx-pill'
    return span
  }
}
