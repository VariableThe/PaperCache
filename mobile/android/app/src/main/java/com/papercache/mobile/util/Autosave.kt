package com.papercache.mobile.util

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Debounced save with a guaranteed flush on navigation away from the editor,
 * and serialized (one-at-a-time) async saves.
 *
 * Mirrors the desktop `useDebouncedSave` behavior: `schedule` restarts a timer
 * that eventually commits the latest pending (noteId, content); `flush` commits
 * the latest pending immediately on navigation. Saves run one at a time so an
 * in-flight save is never overtaken by (and never loses) a newer edit.
 */
class Autosave(
    private val scope: CoroutineScope,
    private val delayMs: Long = 500L,
    private val onSave: suspend (String, String) -> Unit,
) {
    private var pending: Pair<String, String>? = null
    private var debounceJob: Job? = null
    private var saving = false

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
        kick()
    }

    /** Run at most one save at a time, looping while a newer item is pending. */
    private fun kick() {
        if (saving) return
        val p = pending ?: return
        pending = null
        saving = true
        scope.launch {
            try {
                onSave(p.first, p.second)
            } finally {
                saving = false
                kick()
            }
        }
    }

    fun isDirty(): Boolean = pending != null || saving
}
