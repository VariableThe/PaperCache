package com.papercache.mobile.data

import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Synthetic in-memory NoteDao — no Android framework, no disk, no Room. */
class FakeNoteDao : NoteDao {
    private val notes = MutableStateFlow<List<Note>>(emptyList())
    private var clock = 1000L

    /**
     * Test hooks for DETERMINISTIC interleavings (no real concurrency in the
     * fake itself; the gates let a test hold one coroutine at an exact
     * suspension point while another proceeds).
     */
    var writeGate: kotlinx.coroutines.CompletableDeferred<Unit>? = null
    var renameGate: kotlinx.coroutines.CompletableDeferred<Unit>? = null
    var failSoftDelete = false
    var failHardDelete = false

    private fun all(): List<Note> = notes.value
    private fun find(noteId: String): Note? = all().firstOrNull { it.noteId == noteId }

    private fun write(transform: (List<Note>) -> List<Note>) {
        notes.value = transform(all())
    }

    override fun observeActiveNotes(): Flow<List<Note>> =
        kotlinx.coroutines.flow.flow { emit(all().filter { !it.deleted }) }

    override fun observeTrashedNotes(): Flow<List<Note>> =
        kotlinx.coroutines.flow.flow { emit(all().filter { it.deleted }) }

    override fun search(query: String): Flow<List<Note>> =
        kotlinx.coroutines.flow.flow {
            emit(
                all().filter {
                    !it.deleted && (it.path.contains(query) || it.content.contains(query) ||
                        it.tags.contains(query))
                }
            )
        }

    override suspend fun get(noteId: String): Note? = find(noteId)

    override suspend fun saveActiveContent(noteId: String, content: String, mtime: Long): Int {
        // Same semantics as the conditional UPDATE: the write is held at the
        // gate, then applied only while the row is still ACTIVE — a note
        // trashed/deleted mid-save is never resurrected.
        writeGate?.await()
        val existing = find(noteId) ?: return 0
        if (existing.deleted) return 0
        write { list ->
            list.map {
                if (it.noteId == noteId) it.copy(content = content, mtime = mtime) else it
            }
        }
        return 1
    }

    override suspend fun renameIfFree(noteId: String, newPath: String, mtime: Long): Int {
        // Same semantics as the conditional UPDATE: the write is held at the
        // gate, THEN the existence check runs inside the write — a concurrent
        // rename that grabbed the target first wins, the other is refused.
        renameGate?.await()
        val existing = find(noteId) ?: return 0
        if (existing.deleted) return 0
        if (findActiveByPath(newPath, noteId) != null) return 0
        write { list ->
            list.map {
                if (it.noteId == noteId) it.copy(path = newPath, mtime = mtime) else it
            }
        }
        return 1
    }

    override suspend fun findActiveByPath(path: String, excludeId: String): Note? =
        all().firstOrNull { it.path == path && !it.deleted && it.noteId != excludeId }

    override suspend fun activePaths(): List<String> =
        all().filter { !it.deleted }.map { it.path }

    override suspend fun upsert(note: Note) {
        writeGate?.await()
        write { list -> list.filter { it.noteId != note.noteId } + note }
    }

    override suspend fun softDelete(noteId: String, mtime: Long) {
        if (failSoftDelete) throw RuntimeException("db error")
        write { list ->
            list.map { if (it.noteId == noteId) it.copy(deleted = true, mtime = mtime) else it }
        }
    }

    override suspend fun restoreIfFree(noteId: String, mtime: Long): Int {
        // Same semantics as the conditional UPDATE: the trashed note is
        // reactivated only if no OTHER active note occupies its path.
        val existing = find(noteId) ?: return 0
        if (!existing.deleted) return 0
        if (findActiveByPath(existing.path, noteId) != null) return 0
        write { list ->
            list.map {
                if (it.noteId == noteId) it.copy(deleted = false, mtime = mtime) else it
            }
        }
        return 1
    }

    override suspend fun hardDelete(noteId: String) {
        if (failHardDelete) throw RuntimeException("db error")
        write { list -> list.filter { it.noteId != noteId } }
    }

    /** Test helper: current synthetic state. */
    fun snapshot(): List<Note> = all()

    fun tick(): Long {
        clock += 1
        return clock
    }
}

class NoteRepositoryTest {

    private fun note(id: String, path: String, deleted: Boolean = false) =
        Note(noteId = id, path = path, content = "", mtime = 0, deleted = deleted)

    @Test
    fun renameIfFreeRefusesAnOccupiedPathAndPreservesBothNotes() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "a.md"))
        dao.upsert(note("b", "b.md"))

        // Rename A onto B's live path: refused, both untouched.
        val ok = repo.renameIfFree("a", "b.md", dao.tick())

        assertFalse(ok)
        assertEquals("a.md", dao.snapshot().first { it.noteId == "a" }.path)
        assertEquals("b.md", dao.snapshot().first { it.noteId == "b" }.path)
    }

    @Test
    fun renameIfFreeAllowsAFreePath() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "a.md"))

        val ok = repo.renameIfFree("a", "renamed.md", dao.tick())

        assertTrue(ok)
        assertEquals("renamed.md", dao.snapshot().first { it.noteId == "a" }.path)
    }

    @Test
    fun renameIfFreeAllowsReusingATrashedNotesPath() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "a.md"))
        dao.upsert(note("b", "b.md"))
        dao.softDelete("b", dao.tick())

        // b no longer occupies a live vault path; a may take it.
        val ok = repo.renameIfFree("a", "b.md", dao.tick())

        assertTrue(ok)
        assertEquals("b.md", dao.snapshot().first { it.noteId == "a" }.path)
        assertTrue(dao.snapshot().first { it.noteId == "b" }.deleted)
    }

    @Test
    fun renameIfFreeSamePathIsANoopSuccess() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "a.md"))
        val before = dao.snapshot().first { it.noteId == "a" }

        val ok = repo.renameIfFree("a", "a.md", dao.tick())

        assertTrue(ok)
        // No mtime touch on a no-op.
        assertEquals(before, dao.snapshot().first { it.noteId == "a" })
    }

    @Test
    fun renameIfFreeOfAMissingNoteIsRefused() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)

        // No note: nothing to rename; nothing to create.
        val ok = repo.renameIfFree("ghost", "x.md", dao.tick())

        assertFalse(ok)
    }

    @Test
    fun nextUntitledPathNeverCollidesWithALiveNote() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "Untitled.md"))
        dao.upsert(note("b", "Untitled (2).md"))

        val p1 = repo.nextUntitledPath()
        assertEquals("Untitled (3).md", p1)

        dao.upsert(note("c", p1))
        val p2 = repo.nextUntitledPath()
        assertEquals("Untitled (4).md", p2)
    }

    @Test
    fun nextUntitledPathIgnoresTrashedNotes() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "Untitled.md"))
        dao.softDelete("a", dao.tick())

        assertEquals("Untitled.md", repo.nextUntitledPath())
    }


    @Test
    fun concurrentRenamesToTheSameTargetNeverDuplicateAPath() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "a.md"))
        dao.upsert(note("b", "b.md"))

        // Both renames pass their existence check before either write
        // commits (the gate holds them at the write); at most one may win
        // the target path.
        dao.renameGate = kotlinx.coroutines.CompletableDeferred()
        val a = async { repo.renameIfFree("a", "x.md", 10) }
        val b = async { repo.renameIfFree("b", "x.md", 11) }
        advanceUntilIdle()
        dao.renameGate!!.complete(Unit)
        advanceUntilIdle()
        val results = listOf(a.await(), b.await())

        val xNotes = dao.snapshot().filter { it.path == "x.md" && !it.deleted }
        assertEquals(1, xNotes.size)
        // Exactly one rename succeeded; the other was refused cleanly.
        assertEquals(1, results.count { it })
        assertEquals(1, results.count { !it })
    }



    @Test
    fun createAndRenameToTheSameFreePathNeverDuplicateIt() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "a.md"))

        // The create picks "Untitled.md" (free) and is held at its INSERT;
        // a concurrent rename to that same still-free path must not be able
        // to interleave between the create's path selection and its write.
        dao.writeGate = kotlinx.coroutines.CompletableDeferred()
        val created = async { repo.createUntitled("n", "", 10) }
        advanceUntilIdle() // create suspended at the write, path already chosen

        val renamed = async { repo.renameIfFree("a", "Untitled.md", 11) }
        advanceUntilIdle()

        dao.writeGate!!.complete(Unit)
        advanceUntilIdle()
        created.await()
        renamed.await()

        val untitled = dao.snapshot().filter { it.path == "Untitled.md" && !it.deleted }
        assertEquals("create and rename both claimed the free path", 1, untitled.size)
    }

    @Test
    fun createAndRestoreToSamePathNeverDuplicateIt() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("old", "Untitled.md"))
        repo.softDelete("old", 1)
        dao.writeGate = kotlinx.coroutines.CompletableDeferred()
        val created = async { repo.createUntitled("new", "", 2) }
        advanceUntilIdle()
        val restored = async { repo.restore("old", 3) }
        advanceUntilIdle()
        dao.writeGate!!.complete(Unit)
        advanceUntilIdle()
        created.await()
        restored.await()
        assertEquals(1, dao.snapshot().count { !it.deleted && it.path == "Untitled.md" })
    }

    @Test
    fun restoringATrashedNoteRefusesWhenAnotherActiveNoteNowHoldsItsPath() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "x.md"))
        dao.upsert(note("b", "b.md"))

        repo.softDelete("a", 10)
        // While "a" is trashed, "b" takes the now-free path.
        assertTrue(repo.renameIfFree("b", "x.md", 11))

        // Restoring "a" must not produce two active notes on "x.md".
        val restored = repo.restore("a", 12)
        assertFalse("restore resurrected a duplicate active path", restored)
        val xActive = dao.snapshot().filter { it.path == "x.md" && !it.deleted }
        assertEquals(1, xActive.size)
        assertEquals("b", xActive.single().noteId)
        // The trashed note itself must still be there (recoverable later).
        assertTrue(dao.snapshot().single { it.noteId == "a" }.deleted)
    }


    @Test
    fun restoringSucceedsOnceTheConflictingNoteMovesAway() = runTest {
        val dao = FakeNoteDao()
        val repo = NoteRepository(dao)
        dao.upsert(note("a", "x.md"))
        dao.upsert(note("b", "b.md"))

        repo.softDelete("a", 10)
        assertTrue(repo.renameIfFree("b", "x.md", 11))
        assertFalse(repo.restore("a", 12)) // refused: "b" holds x.md

        // The user renames "b" away; the restore now succeeds.
        assertTrue(repo.renameIfFree("b", "y.md", 13))
        assertTrue(repo.restore("a", 14))
        val xActive = dao.snapshot().filter { it.path == "x.md" && !it.deleted }
        assertEquals(listOf("a"), xActive.map { it.noteId })
    }
}
