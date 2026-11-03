import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced save with a guaranteed flush on teardown and serialized (one-at-a-
 * time) async saves.
 *
 * The previous in-component implementation scheduled a `setTimeout` and cleared
 * it on note switch, silently losing edits made within the debounce window. In
 * addition, an async save fired and forgotten could be overtaken by a newer
 * edit, writing stale content. This hook keeps the latest pending item, flushes
 * on note switch/unmount, and runs at most one save at a time so an in-flight
 * save is never overtaken by (and never loses) a newer edit.
 */
export interface DebouncedSave<T> {
  schedule: (item: T) => void
  flush: () => void
  isDirty: () => boolean
}

/** Run at most one save at a time, looping while a newer item is pending. */
function runSaveLoop<T>(
  save: (item: T) => void | Promise<unknown>,
  pending: { current: T | null },
  saving: { current: boolean }
): void {
  if (saving.current) return
  if (pending.current === null) return
  const item = pending.current
  pending.current = null

  const result = save(item)
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    saving.current = true
    Promise.resolve(result).finally(() => {
      saving.current = false
      runSaveLoop(save, pending, saving)
    })
  } else {
    // Synchronous save: it already completed; continue any queued item.
    runSaveLoop(save, pending, saving)
  }
}

export function useDebouncedSave<T>(
  save: (item: T) => void | Promise<unknown>,
  delayMs = 500
): DebouncedSave<T> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<T | null>(null)
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
    runSaveLoop(saveRef.current, pendingRef, savingRef)
  }, [])

  const isDirty = useCallback(() => pendingRef.current !== null || savingRef.current, [])

  const schedule = useCallback(
    (item: T) => {
      pendingRef.current = item
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        flush()
      }, delayMs)
    },
    [delayMs, flush]
  )

  // On unmount, flush any pending edit rather than dropping it.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      flush()
    }
  }, [flush])

  return { schedule, flush, isDirty }
}
