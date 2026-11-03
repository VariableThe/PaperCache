import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced save with a guaranteed flush on teardown, serialized (one-at-a-time)
 * async saves, and per-note pending state.
 *
 * Each note's latest pending item is keyed by `id`, so an edit to one note can
 * never displace a pending edit to another note. Saves run one at a time so an
 * in-flight save is never overtaken by (and never loses) a newer edit, and a
 * failed save re-queues its item so the content is preserved as still-dirty.
 */
export interface DebouncedSave<T> {
  schedule: (item: T) => void
  flush: () => void
  isDirty: () => boolean
}

/** Run at most one save at a time, looping over the per-note pending map. */
function runSaveLoop<T extends { id: string }>(
  save: (item: T) => void | Promise<unknown>,
  pending: Map<string, T>,
  saving: { current: boolean }
): void {
  if (saving.current) return
  const key = pending.keys().next().value
  if (key === undefined) return
  const item = pending.get(key)!
  pending.delete(key)

  const result = save(item)
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    saving.current = true
    Promise.resolve(result).then(
      () => {
        saving.current = false
        runSaveLoop(save, pending, saving)
      },
      () => {
        // Save failed: preserve the content as still-pending (dirty) so a later
        // flush can retry — but only if a newer edit for the same note hasn't
        // already superseded it.
        if (!pending.has(key)) {
          pending.set(key, item)
        }
        saving.current = false
      }
    )
  } else {
    // Synchronous save: it already completed; continue any queued item.
    runSaveLoop(save, pending, saving)
  }
}

export function useDebouncedSave<T extends { id: string }>(
  save: (item: T) => void | Promise<unknown>,
  delayMs = 500
): DebouncedSave<T> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(new Map<string, T>())
  const savingRef = useRef(false)
  const saveRef = useRef(save)

  // Keep the latest save callback without changing `flush`/`schedule` identity.
  useEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    runSaveLoop(saveRef.current, pendingRef.current, savingRef)
  }, [])

  const isDirty = useCallback(() => pendingRef.current.size > 0 || savingRef.current, [])

  const schedule = useCallback(
    (item: T) => {
      pendingRef.current.set(item.id, item)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        flush()
      }, delayMs)
    },
    [delayMs, flush]
  )

  // On unmount, flush any pending edits rather than dropping them.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      flush()
    }
  }, [flush])

  return { schedule, flush, isDirty }
}
