package com.papercache.mobile.ui

import com.papercache.mobile.data.FakeNoteDao
import com.papercache.mobile.data.Note
import com.papercache.mobile.data.NoteRepository
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Race regressions for the ViewModel's autosave/mutation coordination.
 * All interleavings are DETERMINISTIC: the fake DAO's gates hold a coroutine
 * at an exact suspension point while the test drives another mutation.
 */
class NoteViewModelTest {

    private lateinit var dao: FakeNoteDao
    private lateinit var repo: NoteRepository
    private val mainDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        dao = FakeNoteDao()
        repo = NoteRepository(dao)
        kotlinx.coroutines.Dispatchers.setMain(mainDispatcher)
    }

    @After
    fun tearDown() {
        kotlinx.coroutines.Dispatchers.resetMain()
    }

    private suspend fun seedNote(id: String, path: String): Note {
        val note = Note(noteId = id, path = path, content = "", mtime = 1)
        dao.upsert(note)
        return note
    }

    @Test
    fun trashingANoteWhileItsSaveIsInFlightDoesNotResurrectIt() = runTest(mainDispatcher) {
        seedNote("a", "a.md")
        val vm = NoteViewModel(repo)
        vm.openNote("a")
        advanceUntilIdle()

        // A save goes in flight and is held at the database write.
        dao.writeGate = CompletableDeferred()
        vm.onEditorChange("hello")
        advanceUntilIdle() // the save is now suspended at the write

        // The user trashes the note while the write is in flight.
        vm.trashCurrent()
        advanceUntilIdle()
        assertTrue(dao.snapshot().first { it.noteId == "a" }.deleted)

        // The held write completes: it must NOT bring the note back.
        dao.writeGate!!.complete(Unit)
        advanceUntilIdle()

        val a = dao.snapshot().firstOrNull { it.noteId == "a" }
        assertTrue("trashed note was resurrected by the in-flight save", a!!.deleted)
    }

    @Test
    fun hardDeletingANoteWhileItsSaveIsInFlightDoesNotResurrectIt() = runTest(mainDispatcher) {
        seedNote("a", "a.md")
        val vm = NoteViewModel(repo)
        vm.openNote("a")
        advanceUntilIdle()

        dao.writeGate = CompletableDeferred()
        vm.onEditorChange("hello")
        advanceUntilIdle() // save in flight, held at the write

        // Hard-delete lands while the write is in flight.
        vm.hardDelete("a")
        advanceUntilIdle()
        assertEquals(null, dao.snapshot().firstOrNull { it.noteId == "a" })

        dao.writeGate!!.complete(Unit)
        advanceUntilIdle()

        // The note must NOT come back from the held write.
        assertEquals(null, dao.snapshot().firstOrNull { it.noteId == "a" })
    }

    @Test
    fun aFailedTrashKeepsThePendingEditAndTheEditorOpen() = runTest(mainDispatcher) {
        seedNote("a", "a.md")
        val vm = NoteViewModel(repo)
        vm.openNote("a")
        advanceUntilIdle()

        // An unsaved edit is queued (debounce not yet fired).
        vm.onEditorChange("important")
        runCurrent()
        assertTrue(vm.autosave.isDirty())

        // The delete FAILS: the pending edit must be preserved, not discarded.
        dao.failSoftDelete = true
        vm.trashCurrent()
        advanceUntilIdle()

        // The user's edit must be preserved — either still queued or saved to
        // the still-active note — and the editor must stay open. It must NOT
        // be silently discarded because the delete failed.
        val a = dao.snapshot().first { it.noteId == "a" }
        assertFalse("note vanished on a FAILED delete", a.deleted)
        assertTrue("pending edit was discarded on a FAILED delete",
            vm.autosave.isDirty() || a.content == "important")
        assertEquals("a", vm.editingNoteId.value)

        // Storage heals: trashing now works, and only then are the queued
        // bytes discarded (the note is gone on purpose).
        dao.failSoftDelete = false
        vm.trashCurrent()
        advanceUntilIdle()

        assertEquals(null, vm.editingNoteId.value)
        assertFalse(vm.autosave.isDirty())
        assertTrue(dao.snapshot().first { it.noteId == "a" }.deleted)
    }

    @Test
    fun concurrentCreatesNeverShareAPath() = runTest(mainDispatcher) {
        val vm = NoteViewModel(repo)

        // Two creates race; the first create's database write is held at the
        // gate so the second create must not observe a half-committed state.
        dao.writeGate = CompletableDeferred()
        vm.createNote()
        vm.createNote()
        advanceUntilIdle() // both creates are in flight

        dao.writeGate!!.complete(Unit)
        advanceUntilIdle()

        val paths = dao.snapshot().filter { !it.deleted }.map { it.path }
        assertEquals(2, paths.size)
        assertEquals(2, paths.toSet().size)
    }

}

// (Concurrent-rename race coverage lives in NoteRepositoryTest — it is a
// repository-level check-then-write race, not a ViewModel concern.)
