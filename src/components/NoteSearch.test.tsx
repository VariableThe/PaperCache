import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { confirm } from '@tauri-apps/plugin-dialog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore, type Note } from '../store/useAppStore'
import { NoteSearch } from './NoteSearch'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn().mockResolvedValue(true),
}))

const note = (name: string): Note => ({ id: `${name}.md`, content: name, mtime: 0 })
const alpha = note('alpha')
const beta = note('beta')
const gamma = note('gamma')

function renderSearch(notes: Note[] = [alpha, beta, gamma]) {
  useAppStore.setState({ notes })
  render(<NoteSearch />)
  return screen.getByPlaceholderText('Search notes by content...')
}

function updateNotes(notes: Note[]) {
  act(() => useAppStore.getState().setNotes(notes))
}

describe('NoteSearch selection', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentNoteIndex: 0,
      isHyprland: false,
      showNoteSearch: true,
      noteSearchQuery: '',
      searchSelectedIndex: 0,
      showNoteActionMenu: false,
      actionMenuIndex: 0,
    })
  })

  afterEach(cleanup)

  it('opens a visible result when the selected index becomes stale', () => {
    const input = renderSearch()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByText('gamma').closest('.note-search-item')).toHaveClass('selected')

    updateNotes([alpha])
    expect(screen.getByText('alpha').closest('.note-search-item')).toHaveClass('selected')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useAppStore.getState().showNoteSearch).toBe(false)
    expect(useAppStore.getState().currentNoteIndex).toBe(0)
  })

  it('does not select a negative index on an empty list', () => {
    const input = renderSearch([])
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useAppStore.getState().showNoteSearch).toBe(true)

    updateNotes([alpha])
    expect(screen.getByText('alpha').closest('.note-search-item')).toHaveClass('selected')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useAppStore.getState().showNoteSearch).toBe(false)
  })

  it('keeps the keyboard action menu bound to the same note after reorder', async () => {
    const input = renderSearch()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true })
    updateNotes([beta, alpha, gamma])

    const row = screen.getByText('beta').closest<HTMLElement>('.note-search-item')!
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeVisible()
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.electronAPI.deleteNote).toHaveBeenCalledExactlyOnceWith('beta.md')
    })
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('closes an action menu for a missing note without acting on another note', () => {
    const input = renderSearch()
    const row = screen.getByText('beta').closest('.note-search-item')!
    fireEvent.contextMenu(row)
    updateNotes([alpha, gamma])

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(confirm).not.toHaveBeenCalled()
    expect(window.electronAPI.deleteNote).not.toHaveBeenCalled()
    expect(useAppStore.getState().showNoteSearch).toBe(true)
    expect(useAppStore.getState().showNoteActionMenu).toBe(false)
  })
})
