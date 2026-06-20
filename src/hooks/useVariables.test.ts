import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVariables } from './useVariables'
import { useAppStore } from '../store/useAppStore'

describe('useVariables', () => {
  beforeEach(() => {
    // Reset global state
    ;(window as any).__globalVariables = undefined

    // Reset store
    useAppStore.setState({ notes: [] })

    // Clear mocks
    vi.clearAllMocks()
  })

  it('should parse simple variables', async () => {
    useAppStore.setState({
      notes: [{ id: '1', content: '/globvar x = 10\n/globvar y = 20', mtime: 0 }],
    })

    renderHook(() => useVariables())

    await waitFor(() => {
      expect((window as any).__globalVariables).toBeDefined()
      expect((window as any).__globalVariables.x).toBe(10)
      expect((window as any).__globalVariables.y).toBe(20)
    })
  })

  it('should evaluate math expressions with previous variables', async () => {
    useAppStore.setState({
      notes: [{ id: '1', content: '/globvar a = 5\n/globvar b = a * 2', mtime: 0 }],
    })

    renderHook(() => useVariables())

    await waitFor(() => {
      expect((window as any).__globalVariables).toBeDefined()
      expect((window as any).__globalVariables.a).toBe(5)
      expect((window as any).__globalVariables.b).toBe(10)
    })
  })

  it('should fallback to string if math evaluation fails', async () => {
    useAppStore.setState({
      notes: [{ id: '1', content: '/globvar name = John Doe', mtime: 0 }],
    })

    renderHook(() => useVariables())

    await waitFor(() => {
      expect((window as any).__globalVariables).toBeDefined()
      expect((window as any).__globalVariables.name).toBe('John Doe')
    })
  })

  it('should process variables across multiple notes', async () => {
    useAppStore.setState({
      notes: [
        { id: '1', content: '/globvar val1 = 100', mtime: 0 },
        { id: '2', content: '/globvar val2 = val1 + 50', mtime: 0 },
      ],
    })

    renderHook(() => useVariables())

    await waitFor(() => {
      expect((window as any).__globalVariables).toBeDefined()
      expect((window as any).__globalVariables.val1).toBe(100)
      expect((window as any).__globalVariables.val2).toBe(150)
    })
  })
})
