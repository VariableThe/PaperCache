package com.papercache.mobile.util

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Debounced save with a guaranteed flush on navigation away from the editor,
 * serialized (one-at-a-time) async saves, and per-note pending state.
 *
 * Each note's latest content is keyed by `noteId`, so an edit to one note can
 * never displace a pending edit to another note. Saves run one at a time so an
 * in-flight save is never overtaken by (and never loses) a newer edit, and a
 * failed save re-queues its content so the buffer stays dirty.
 */
class Autosave(
    private val scope: CoroutineScope,
    private val delayMs: Long = 500L,
    private val onSave: suspend (String, String) -> Unit,
) {
    private val pending = mutableMapOf<String, String>()
    private var debounceJob: Job? = null
    private var saving = false

    fun schedule(noteId: String, content: String) {
        pending[noteId] = content
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

    /** Run at most one save at a time, looping over the per-note pending map. */
    private fun kick() {
        if (saving) return
        val entry = pending.entries.firstOrNull() ?: return
        val noteId = entry.key
        val content = entry.value
        pending.remove(noteId)
        saving = true
        scope.launch {
            val success = try {
                onSave(noteId, content)
                true
            } catch (_: Exception) {
                false
            }
            saving = false
            if (success) {
                kick()
            } else if (!pending.containsKey(noteId)) {
                // Preserve as dirty, unless a newer edit already superseded it.
                pending[noteId] = content
            }
        }
    }

    fun isDirty(): Boolean = pending.isNotEmpty() || saving
}
