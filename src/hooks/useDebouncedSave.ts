import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced save with a guaranteed flush on teardown.
 *
 * The previous in-component implementation scheduled a `setTimeout` and
 * cleared it on note switch. Clearing (rather than flushing) the pending timer
 * meant any edits made within the debounce window were silently lost when the
 * user switched notes before the timer fired. This hook keeps a reference to
 * the latest pending item and offers a `flush()` that synchronously commits it,
 * so switching notes (or unmounting) never discards an unsaved buffer.
 */
export interface DebouncedSave<T> {
  schedule: (item: T) => void
  flush: () => void
  isDirty: () => boolean
}

export function useDebouncedSave<T>(
  save: (item: T) => void | Promise<unknown>,
  delayMs = 500
): DebouncedSave<T> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<T | null>(null)
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
    if (pendingRef.current !== null) {
      const item = pendingRef.current
      pendingRef.current = null
      saveRef.current(item)
    }
  }, [])

  const isDirty = useCallback(() => pendingRef.current !== null, [])

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
      if (pendingRef.current !== null) {
        const item = pendingRef.current
        pendingRef.current = null
        saveRef.current(item)
      }
    }
  }, [])

  return { schedule, flush, isDirty }
}
