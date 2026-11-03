package com.papercache.mobile.util

import kotlinx.coroutines.test.advanceUntilIdle
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
}
