package com.papercache.mobile.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class NoteRepository(private val dao: NoteDao) {

    /**
     * There is deliberately NO public unconditional upsert/insert: a plain
     * REPLACE could both duplicate an active path and resurrect a trashed
     * row. All row creation goes through [createUntitled] (mutex-serialized
     * path selection) and all content writes through [saveActiveContent]
     * (conditional on the row still being active).
     */

    /**
     * Serializes every multi-statement path decision: create's
     * path-selection + INSERT, and rename's check + conditional UPDATE.
     * Rename is already atomic on its own (check inside the UPDATE), but it
     * must ALSO be serialized against a concurrent create, whose INSERT is a
     * plain REPLACE with no path condition — otherwise a rename could slip
     * between the create's path selection and its write (both would claim
     * the same free path). Room is a single-process local database, so an
     * in-process mutex plus the conditional DAO writes below is sufficient
     * for path uniqueness; this does NOT claim cross-process protection
     * (Room is single-process by design).
     */
    private val pathMutex = Mutex()


    val activeNotes: Flow<List<Note>> = dao.observeActiveNotes()
    val trashedNotes: Flow<List<Note>> = dao.observeTrashedNotes()

    fun search(query: String): Flow<List<Note>> = dao.search(query)

    suspend fun get(noteId: String): Note? = dao.get(noteId)

    suspend fun softDelete(noteId: String, mtime: Long) = dao.softDelete(noteId, mtime)

    /**
     * Restore a trashed note, refusing when another ACTIVE note now occupies
     * its path (the path may have been legitimately reused while the note
     * was in the trash). Returns true when restored, false when refused —
     * the note then stays in the trash, recoverable once the path is free.
     */
    suspend fun restore(noteId: String, mtime: Long): Boolean =
        dao.restoreIfFree(noteId, mtime) > 0

    suspend fun hardDelete(noteId: String) = dao.hardDelete(noteId)

    /**
     * Save a note's content atomically: a single conditional UPDATE that
     * applies only while the row is still ACTIVE. Returns false when the note
     * was trashed or hard-deleted mid-save (the discard is then deliberate —
     * nothing is resurrected). Unlike read-then-upsert, there is no window
     * in which a concurrent delete can be overwritten by a stale snapshot.
     */
    suspend fun saveActiveContent(noteId: String, content: String, mtime: Long): Boolean =
        dao.saveActiveContent(noteId, content, mtime) > 0

    /**
     * Create a new note with a collision-free default path. The
     * path-selection and the insert are serialized (mutex) so two concurrent
     * creates cannot both observe the same free "Untitled (n).md".
     */
    suspend fun createUntitled(noteId: String, content: String, mtime: Long): String =
        pathMutex.withLock {
            val path = nextUntitledPath()
            dao.upsert(Note(noteId = noteId, path = path, content = content, mtime = mtime))
            path
        }

    /**
     * Rename a note, refusing when another ACTIVE note already occupies the
     * target path — two live notes must never share a path (they would be
     * the same vault file once sync lands, silently merging/overwriting each
     * other). The existence check lives INSIDE the single conditional UPDATE,
     * so concurrent renames onto the same free target cannot both win.
     * Returns true when the rename was applied, false when it was refused
     * (both notes are then left untouched). A path held only by a TRASHED
     * note may be reused: trashed notes no longer occupy a live vault path.
     * Same-path rename is a no-op success.
     */
    suspend fun renameIfFree(noteId: String, newPath: String, mtime: Long): Boolean =
        pathMutex.withLock {
            val existing = dao.get(noteId) ?: return false
            if (existing.path == newPath) return true
            dao.renameIfFree(noteId, newPath, mtime) > 0
        }

    /**
     * The default path for a new note: "Untitled.md", or "Untitled (2).md",
     * "Untitled (3).md", ... — never colliding with an existing ACTIVE note's
     * path.
     */
    suspend fun nextUntitledPath(): String {
        val taken = dao.activePaths().toSet()
        if ("Untitled.md" !in taken) return "Untitled.md"
        var i = 2
        while ("Untitled ($i).md" in taken) i++
        return "Untitled ($i).md"
    }
}
