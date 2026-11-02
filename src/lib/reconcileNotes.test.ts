import { describe, it, expect } from 'vitest'
import { reconcileNotes } from './reconcileNotes'
import type { Note } from '../store/useAppStore'

const n = (id: string, content: string, mtime = 1): Note => ({ id, content, mtime })

describe('reconcileNotes', () => {
  it('adopts external content for non-active notes', () => {
    const current = [n('a.md', 'local a'), n('b.md', 'local b')]
    const fresh = [n('a.md', 'external a'), n('b.md', 'external b')]
    const { notes, conflicts } = reconcileNotes(current, 'a.md', false, fresh)
    expect(notes).toEqual(fresh)
    expect(conflicts).toEqual([])
  })

  it('never overwrites the active dirty buffer, and reports a conflict', () => {
    const current = [n('a.md', 'unsaved local edits')]
    const fresh = [n('a.md', 'external change')]
    const { notes, conflicts } = reconcileNotes(current, 'a.md', true, fresh)
    expect(notes).toEqual([n('a.md', 'unsaved local edits')])
    expect(conflicts).toEqual(['a.md'])
  })

  it('overwrites the active note when it is clean (no pending edits)', () => {
    const current = [n('a.md', 'saved')]
    const fresh = [n('a.md', 'external change')]
    const { notes, conflicts } = reconcileNotes(current, 'a.md', false, fresh)
    expect(notes).toEqual([n('a.md', 'external change')])
    expect(conflicts).toEqual([])
  })

  it('preserves an active dirty buffer when the note was deleted externally', () => {
    const current = [n('a.md', 'unsaved'), n('b.md', 'other')]
    const fresh = [n('b.md', 'other')]
    const { notes, conflicts } = reconcileNotes(current, 'a.md', true, fresh)
    expect(notes.map((x) => x.id)).toEqual(['a.md', 'b.md'])
    expect(conflicts).toEqual(['a.md'])
  })

  it('drops a non-active note that was deleted externally', () => {
    const current = [n('a.md', 'a'), n('b.md', 'b')]
    const fresh = [n('a.md', 'a')]
    const { notes } = reconcileNotes(current, 'a.md', false, fresh)
    expect(notes.map((x) => x.id)).toEqual(['a.md'])
  })

  it('adds notes created externally', () => {
    const current = [n('a.md', 'a')]
    const fresh = [n('a.md', 'a'), n('new.md', 'new')]
    const { notes } = reconcileNotes(current, 'a.md', false, fresh)
    expect(notes.map((x) => x.id)).toEqual(['a.md', 'new.md'])
  })

  it('is a no-op for identical listings', () => {
    const current = [n('a.md', 'a')]
    const { notes, conflicts } = reconcileNotes(current, null, false, current)
    expect(notes).toEqual(current)
    expect(conflicts).toEqual([])
  })
})
