import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { VariableScope, getScope } from './VariableScope'
import { useVariableStore } from '../../store/useVariableStore'

describe('VariableScope', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useVariableStore.getState().setGlobals({})
    useVariableStore.getState().setNoteScope({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('merges global and note scopes in getScope', () => {
    useVariableStore.getState().setGlobals({ globalA: 10, shared: 'global' })
    useVariableStore.getState().setNoteScope({ noteB: 20, shared: 'note' })

    const scope = getScope()
    expect(scope).toEqual({
      globalA: 10,
      noteB: 20,
      shared: 'note',
    })
  })

  it('parses mathematical expressions and updates note scope after debounce', () => {
    const scopeMgr = new VariableScope()
    const doc = '/var x = 10 + 5\n/var y = x * 2'

    scopeMgr.triggerScopeUpdate(doc, null)

    expect(useVariableStore.getState().getNoteScope()).toEqual({})

    vi.advanceTimersByTime(300)

    expect(useVariableStore.getState().getNoteScope()).toEqual({
      x: 15,
      y: 30,
    })
  })

  it('falls back to raw trimmed string if expression parsing fails', () => {
    const scopeMgr = new VariableScope()
    const doc = '/var greeting = Hello World'

    scopeMgr.triggerScopeUpdate(doc, null)
    vi.advanceTimersByTime(300)

    expect(useVariableStore.getState().getNoteScope()).toEqual({
      greeting: 'Hello World',
    })
  })
})
