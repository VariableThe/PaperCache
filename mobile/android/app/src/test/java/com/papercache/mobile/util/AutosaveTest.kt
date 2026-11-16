package com.papercache.mobile.util

import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AutosaveTest {

    @Test
    fun flushCommitsLatestPendingAndClearsDirty() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L) { id, content -> saved.add(id to content) }

        autosave.schedule("n1", "hello")
        autosave.schedule("n1", "hello world")
        assertTrue(autosave.isDirty())

        autosave.flush()
        advanceUntilIdle()

        assertFalse(autosave.isDirty())
        assertEquals(listOf("n1" to "hello world"), saved)
    }

    @Test
    fun flushDoesNothingWhenClean() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L) { id, content -> saved.add(id to content) }

        autosave.flush()

        assertTrue(saved.isEmpty())
        assertFalse(autosave.isDirty())
    }

    @Test
    fun scheduleKeepsOnlyLatestPendingValue() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L) { id, content -> saved.add(id to content) }

        autosave.schedule("n1", "1")
        autosave.schedule("n1", "2")
        autosave.schedule("n1", "3")
        autosave.flush()
        advanceUntilIdle()

        assertEquals(listOf("n1" to "3"), saved)
    }

    @Test
    fun serializesAnInFlightSaveSoANewerEditIsNotLost() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L) { id, content -> saved.add(id to content) }

        // First edit kicks off an in-flight save.
        autosave.schedule("n1", "v1")
        autosave.flush()

        // A newer edit arrives while the first save is still in flight.
        autosave.schedule("n1", "v2")
        autosave.flush()
        advanceUntilIdle()

        // The newer edit must be saved after (never lost by) the in-flight one.
        assertEquals(listOf("n1" to "v1", "n1" to "v2"), saved)
        assertFalse(autosave.isDirty())
    }

    @Test
    fun keepsPendingEditsPerNoteRatherThanASingleSlot() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L) { id, content -> saved.add(id to content) }

        autosave.schedule("a", "a1")
        autosave.flush() // a1 in flight
        autosave.schedule("a", "a2") // pending a2
        autosave.schedule("b", "b1") // pending b1 (must not displace a2)
        advanceUntilIdle()

        assertTrue(saved.contains("a" to "a2"))
        assertTrue(saved.contains("b" to "b1"))
    }

    @Test
    fun preservesPendingContentWhenSaveFails() = runTest {
        var calls = 0
        val autosave = Autosave(this, 500L, retryDelayMs = 2000L, maxRetries = 3) { _, _ ->
            calls++
            throw RuntimeException("disk full")
        }

        autosave.schedule("a", "v1")
        autosave.flush()
        advanceUntilIdle()

        // The save is retried a bounded number of times; the content stays
        // queued (dirty) forever afterwards — never dropped.
        assertEquals(3, calls)
        assertTrue(autosave.isDirty())
    }

    @Test
    fun successAfterFailuresResetsTheRetryBudget() = runTest {
        var calls = 0
        var fails = true
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L, retryDelayMs = 2000L, maxRetries = 3) { id, c ->
            calls++
            if (fails) throw RuntimeException("disk full")
            saved.add(id to c)
        }

        autosave.schedule("a", "v1")
        autosave.flush()
        advanceUntilIdle() // 3 failed attempts; budget exhausted; stays dirty
        assertEquals(3, calls)
        assertTrue(autosave.isDirty())

        // Storage heals and the user edits again: the new edit resets the
        // budget and saves fine.
        fails = false
        autosave.schedule("a", "v2")
        autosave.flush()
        advanceUntilIdle()

        assertEquals(listOf("a" to "v2"), saved)
        assertFalse(autosave.isDirty())
    }

    @Test
    fun aFailedNoteDoesNotStarveAHealthyOne() = runTest {
        var failsForA = true
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L, retryDelayMs = 2000L, maxRetries = 3) { id, c ->
            if (id == "a" && failsForA) throw RuntimeException("disk full")
            saved.add(id to c)
        }

        autosave.schedule("a", "a1")
        autosave.schedule("b", "b1")
        autosave.flush()
        advanceUntilIdle()

        // b's save is not blocked by a's persistent failure.
        assertTrue(saved.contains("b" to "b1"))
        assertTrue(autosave.isDirty()) // a stays dirty
    }

    @Test
    fun cancelDropsTheQueuedBytesOfADeletedNote() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val autosave = Autosave(this, 500L) { id, content -> saved.add(id to content) }

        autosave.schedule("a", "v1")
        autosave.cancel("a") // deliberate delete before the debounce fires
        advanceUntilIdle()

        assertTrue(saved.isEmpty())
        assertFalse(autosave.isDirty())
    }

    @Test
    fun cancelDuringAnInFlightSaveDiscardsItsCompletion() = runTest {
        val saved = mutableListOf<Pair<String, String>>()
        val gate = kotlinx.coroutines.CompletableDeferred<Unit>()
        val autosave = Autosave(this, 500L, retryDelayMs = 2000L, maxRetries = 5) { id, c ->
            saved.add(id to c)
            gate.await()
            throw RuntimeException("disk full") // the in-flight save fails
        }

        autosave.schedule("a", "v1")
        autosave.flush()
        runCurrent() // the save is now in flight, waiting on the gate

        // The note is deleted while its save is in flight.
        autosave.cancel("a")
        gate.complete(Unit)
        advanceUntilIdle()

        // Exactly one save attempt (the in-flight one); its failure must NOT
        // re-queue the deleted note's bytes or arm a retry.
        assertEquals(listOf("a" to "v1"), saved)
        assertFalse(autosave.isDirty())
    }
}
