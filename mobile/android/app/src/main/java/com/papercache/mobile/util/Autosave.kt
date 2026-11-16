package com.papercache.mobile.util

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Debounced save with a guaranteed flush on navigation away from the editor,
 * serialized (one-at-a-time) async saves, per-note pending state, bounded
 * retry of failed saves, queue fairness, and deliberate-discard support for
 * deleted notes.
 *
 * Each note's latest content is keyed by `noteId`, so an edit to one note can
 * never displace a pending edit to another note. Saves run one at a time so
 * an in-flight save is never overtaken by (and never loses) a newer edit.
 *
 * - A failed save re-queues its content (at the END of the queue) and the
 *   loop continues with the next pending note — a persistently failing note
 *   can never starve a healthy one. Failed content is retried a bounded
 *   number of times (one shared retry timer); a newer edit or a later
 *   success resets the budget. Content is never dropped.
 * - A newer edit replaces the queued entry with a NEW token, so even mid-pass
 *   it still gets its own save attempt in the same flush.
 * - `cancel(noteId)` deliberately discards a note's queued bytes (the note was
 *   deleted/trashed on purpose). A per-note generation counter also discards
 *   the completion of a save that was still in flight when the note was
 *   cancelled, so a late failure can never re-queue a deleted note's content.
 */
class Autosave(
    private val scope: CoroutineScope,
    private val delayMs: Long = 500L,
    private val retryDelayMs: Long = 2000L,
    private val maxRetries: Int = 5,
    private val onSave: suspend (String, String) -> Unit,
) {
    private class Entry(val content: String, val token: Long)

    private val pending = LinkedHashMap<String, Entry>()
    private val attempts = mutableMapOf<String, Int>()
    private val gens = mutableMapOf<String, Long>()
    private var token = 0L
    private var attemptedInPass: MutableSet<Long>? = null
    private var debounceJob: Job? = null
    private var retryJob: Job? = null
    private var saving = false

    fun schedule(noteId: String, content: String) {
        pending[noteId] = Entry(content, ++token)
        // A newer edit resets the note's retry budget and supersedes any
        // older queued bytes.
        attempts.remove(noteId)
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(delayMs)
            flush()
        }
    }

    fun flush() {
        debounceJob?.cancel()
        debounceJob = null
        // A flush is a new driver event: every queued entry (including one
        // that failed earlier) gets at most one fresh attempt in this pass.
        attemptedInPass = null
        kick()
    }

    /**
     * Discard the queued bytes for a note that was deleted or trashed on
     * purpose. If a save for it is already in flight, its completion is
     * discarded too (generation bump), so a late failure cannot re-queue the
     * dead note's content and a late success cannot mark it clean.
     */
    fun cancel(noteId: String) {
        pending.remove(noteId)
        attempts.remove(noteId)
        gens[noteId] = (gens[noteId] ?: 0L) + 1L
    }

    /**
     * Run at most one save at a time, looping over the per-note pending map.
     * Each queued entry is attempted at most once per pass (tracked by its
     * token); a newer edit replacing a failed entry mid-pass still gets its
     * own attempt. When no unattempted entries remain, the pass ends; a
     * failed note's retry timer re-drives the queue after `retryDelayMs`.
     */
    private fun kick() {
        if (saving) return
        val pass = attemptedInPass ?: mutableSetOf<Long>().also { attemptedInPass = it }
        val next = pending.entries.firstOrNull { it.value.token !in pass }
        if (next == null) {
            // Pass complete.
            attemptedInPass = null
            return
        }
        val noteId = next.key
        val entry = next.value
        val gen = gens[noteId] ?: 0L
        pending.remove(noteId)
        pass.add(entry.token)
        saving = true
        scope.launch {
            val success = try {
                onSave(noteId, entry.content)
                true
            } catch (_: Exception) {
                false
            }
            saving = false
            if (success) {
                attempts.remove(noteId)
            } else if ((gens[noteId] ?: 0L) == gen) {
                // Preserve as dirty — at the END of the queue — unless a
                // newer edit already superseded this content. A save for a
                // note cancelled mid-flight (generation moved on) re-queues
                // nothing: the delete was deliberate.
                if (!pending.containsKey(noteId)) {
                    pending[noteId] = Entry(entry.content, entry.token)
                }
                val attempt = (attempts[noteId] ?: 0) + 1
                attempts[noteId] = attempt
                if (attempt < maxRetries && retryJob == null) {
                    retryJob = scope.launch {
                        delay(retryDelayMs)
                        retryJob = null
                        kick()
                    }
                }
            }
            // Continue the pass with the next pending entry.
            kick()
        }
    }

    fun isDirty(): Boolean = pending.isNotEmpty() || saving
}
