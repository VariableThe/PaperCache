package com.papercache.mobile.util

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Debounced save with a guaranteed flush on navigation away from the editor.
 *
 * Mirrors the desktop `useDebouncedSave` behavior: `schedule` restarts a timer
 * that eventually commits the latest pending (noteId, content); `flush`
 * commits the latest pending value immediately and is called when leaving the
 * editor, so edits made inside the debounce window are never dropped.
 */
class Autosave(
    private val scope: CoroutineScope,
    private val delayMs: Long = 500L,
    private val onSave: (String, String) -> Unit,
) {
    private var pending: Pair<String, String>? = null
    private var debounceJob: Job? = null

    fun schedule(noteId: String, content: String) {
        pending = noteId to content
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(delayMs)
            flush()
        }
    }

    fun flush() {
        debounceJob?.cancel()
        debounceJob = null
        val p = pending ?: return
        pending = null
        onSave(p.first, p.second)
    }

    fun isDirty(): Boolean = pending != null
}
