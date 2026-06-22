import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVariables } from './useVariables'
import { useVariableStore } from '../store/useVariableStore'
import { useAppStore } from '../store/useAppStore'

describe('useVariables', () => {
  beforeEach(() => {
    // Reset global state
    useVariableStore.setState({ globals: {} })

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
      const vars = useVariableStore.getState().globals
      expect(vars).toBeDefined()
      expect(vars.x).toBe(10)
      expect(vars.y).toBe(20)
    })
  })

  it('should evaluate math expressions with previous variables', async () => {
    useAppStore.setState({
      notes: [{ id: '1', content: '/globvar a = 5\n/globvar b = a * 2', mtime: 0 }],
    })

    renderHook(() => useVariables())

    await waitFor(() => {
      const vars = useVariableStore.getState().globals
      expect(vars).toBeDefined()
      expect(vars.a).toBe(5)
      expect(vars.b).toBe(10)
    })
  })

  it('should fallback to string if math evaluation fails', async () => {
    useAppStore.setState({
      notes: [{ id: '1', content: '/globvar name = John Doe', mtime: 0 }],
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useVariables())

    await waitFor(() => {
      const vars = useVariableStore.getState().globals
      expect(vars).toBeDefined()
      expect(vars.name).toBe('John Doe')
    })
    consoleSpy.mockRestore()
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
      const vars = useVariableStore.getState().globals
      expect(vars).toBeDefined()
      expect(vars.val1).toBe(100)
      expect(vars.val2).toBe(150)
    })
  })
})
