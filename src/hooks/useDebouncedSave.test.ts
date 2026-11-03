import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedSave } from './useDebouncedSave'

type Note = { id: string; content: string }

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes the latest pending value when the debounce elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave<Note>(save))

    act(() => result.current.schedule({ id: 'a.md', content: 'hello' }))
    act(() => result.current.schedule({ id: 'a.md', content: 'hello world' }))

    expect(save).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(500))

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: 'hello world' })
  })

  it('flush commits a pending edit immediately instead of dropping it', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave<Note>(save))

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
    const { result } = renderHook(() => useDebouncedSave<Note>(save))

    act(() => result.current.flush())
    expect(save).not.toHaveBeenCalled()
  })

  it('flushes the pending edit on unmount', () => {
    const save = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedSave<Note>(save))

    act(() => result.current.schedule({ id: 'a.md', content: 'last words' }))

    unmount()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: 'last words' })
  })

  it('keeps the latest item when several schedules happen within the window', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave<Note>(save))

    act(() => result.current.schedule({ id: 'a.md', content: '1' }))
    act(() => result.current.schedule({ id: 'a.md', content: '2' }))
    act(() => result.current.schedule({ id: 'a.md', content: '3' }))
    act(() => result.current.flush())

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ id: 'a.md', content: '3' })
  })

  it('serializes an in-flight async save so a newer edit is not lost', async () => {
    let resolveFirst!: (v: unknown) => void
    const saved: Note[] = []
    const save = vi.fn((item: Note) => {
      if (saved.length === 0) {
        saved.push(item)
        return new Promise((resolve) => {
          resolveFirst = resolve
        })
      }
      saved.push(item)
      return Promise.resolve()
    })

    const { result } = renderHook(() => useDebouncedSave(save))

    // First edit fires an async save that stays in flight.
    act(() => result.current.schedule({ id: 'a.md', content: 'v1' }))
    act(() => vi.advanceTimersByTime(500))
    expect(saved).toEqual([{ id: 'a.md', content: 'v1' }])

    // A newer edit arrives while the first save is still in flight.
    act(() => result.current.schedule({ id: 'a.md', content: 'v2' }))
    act(() => vi.advanceTimersByTime(500))
    // The second save must not be issued while the first is in flight.
    expect(saved).toEqual([{ id: 'a.md', content: 'v1' }])
    expect(result.current.isDirty()).toBe(true)

    // Resolve the in-flight save; the newer edit must now be saved.
    await act(async () => {
      resolveFirst(undefined)
      await Promise.resolve()
    })
    expect(saved).toEqual([
      { id: 'a.md', content: 'v1' },
      { id: 'a.md', content: 'v2' },
    ])
  })

  it('keeps pending edits per note rather than a single slot', async () => {
    const saved: Note[] = []
    const save = vi.fn((item: Note) => {
      saved.push(item)
      return Promise.resolve()
    })

    const { result } = renderHook(() => useDebouncedSave(save))

    // Edit A (save in flight), edit A again, then edit B.
    act(() => result.current.schedule({ id: 'a.md', content: 'a1' }))
    act(() => vi.advanceTimersByTime(500))
    act(() => result.current.schedule({ id: 'a.md', content: 'a2' }))
    act(() => result.current.schedule({ id: 'b.md', content: 'b1' }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const seen = saved.map((s) => `${s.id}:${s.content}`)
    expect(seen).toContain('a.md:a2')
    expect(seen).toContain('b.md:b1')
  })

  it('preserves a pending item when the save rejects (stays dirty)', async () => {
    const save = vi.fn(() => Promise.reject(new Error('disk full')))
    const { result } = renderHook(() => useDebouncedSave<Note>(save))

    act(() => result.current.schedule({ id: 'a.md', content: 'v1' }))
    act(() => result.current.flush())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.isDirty()).toBe(true)
  })
})
