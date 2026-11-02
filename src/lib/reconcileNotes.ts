import type { Note } from '../store/useAppStore'

export interface ReconcileResult {
  notes: Note[]
  /** ids of notes where the local buffer was kept over a conflicting external change */
  conflicts: string[]
}

/**
 * Reconcile the in-memory note list against a fresh on-disk listing.
 *
 * Invariants (see docs/sync-protocol.md §6):
 * - An active note with an unsaved (dirty) buffer is NEVER overwritten by an
 *   externally changed file; the local buffer wins and the id is reported as a
 *   conflict.
 * - A note deleted externally is dropped, except an active dirty buffer, which
 *   is preserved (and reported as a conflict).
 * - Notes created externally are added.
 */
export function reconcileNotes(
  current: Note[],
  activeId: string | null,
  isActiveDirty: boolean,
  fresh: Note[]
): ReconcileResult {
  const freshById = new Map(fresh.map((n) => [n.id, n]))
  const conflicts: string[] = []
  const notes: Note[] = []

  for (const n of current) {
    const f = freshById.get(n.id)

    if (!f) {
      // Externally deleted. Preserve only an active dirty buffer.
      if (n.id === activeId && isActiveDirty) {
        notes.push(n)
        conflicts.push(n.id)
      }
      continue
    }

    if (n.id === activeId && isActiveDirty) {
      // Never overwrite the active unsaved buffer.
      if (f.content !== n.content) conflicts.push(n.id)
      notes.push(n)
    } else {
      // Adopt the external (on-disk) content and mtime.
      notes.push(f)
    }
    freshById.delete(n.id)
  }

  // Notes that appeared externally.
  for (const f of freshById.values()) {
    notes.push(f)
  }

  return { notes, conflicts }
}
