import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedSave } from './useDebouncedSave'

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes the latest pending value when the debounce elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => result.current.schedule({ id: 'a.md', content: 'hello' }))
    act(() => result.current.schedule({ id: 'a.md', content: 'hello world' }))

    expect(save).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(500))

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: 'hello world' })
  })

  it('flush commits a pending edit immediately instead of dropping it', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => result.current.schedule({ id: 'a.md', content: 'typed' }))

    // Simulate switching notes before the 500ms timer fires.
    act(() => result.current.flush())

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: 'typed' })

    // No later duplicate save from the cleared timer.
    act(() => vi.advanceTimersByTime(1000))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not call save when nothing is pending', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => result.current.flush())
    expect(save).not.toHaveBeenCalled()
  })

  it('flushes the pending edit on unmount', () => {
    const save = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedSave(save))

    act(() => result.current.schedule({ id: 'a.md', content: 'last words' }))

    unmount()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: 'last words' })
  })

  it('keeps the latest item when several schedules happen within the window', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => result.current.schedule({ id: 'a.md', content: '1' }))
    act(() => result.current.schedule({ id: 'a.md', content: '2' }))
    act(() => result.current.schedule({ id: 'a.md', content: '3' }))
    act(() => result.current.flush())

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: '3' })
  })
})
