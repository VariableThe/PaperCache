import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useAppStore.setState({
      notes: [],
      currentNoteIndex: 0,
      showGraphView: false,
      showRemindersView: false,
      isRenaming: false,
      renameValue: '',
      showNoteSearch: false,
      noteSearchQuery: '',
      searchSelectedIndex: 0,
      showNoteActionMenu: false,
      showMainActionMenu: false,
      actionMenuIndex: 0,
    })
  })

  it('should initialize with default state', () => {
    const state = useAppStore.getState()
    expect(state.notes).toEqual([])
    expect(state.currentNoteIndex).toBe(0)
    expect(state.showNoteSearch).toBe(false)
  })

  it('should set notes and support functional updates', () => {
    const { setNotes } = useAppStore.getState()

    // Set notes directly
    setNotes([{ id: '1', content: 'test', mtime: 123 }])
    expect(useAppStore.getState().notes).toHaveLength(1)
    expect(useAppStore.getState().notes[0].content).toBe('test')

    // Functional update
    setNotes((prev) => [...prev, { id: '2', content: 'test2', mtime: 456 }])
    expect(useAppStore.getState().notes).toHaveLength(2)
  })

  it('should set current note index', () => {
    useAppStore.getState().setCurrentNoteIndex(2)
    expect(useAppStore.getState().currentNoteIndex).toBe(2)
  })

  it('should handle functional updates for boolean toggles', () => {
    const { setShowGraphView, setShowNoteSearch } = useAppStore.getState()

    setShowGraphView(true)
    expect(useAppStore.getState().showGraphView).toBe(true)

    setShowGraphView((prev) => !prev)
    expect(useAppStore.getState().showGraphView).toBe(false)

    setShowNoteSearch(true)
    expect(useAppStore.getState().showNoteSearch).toBe(true)
  })
})
