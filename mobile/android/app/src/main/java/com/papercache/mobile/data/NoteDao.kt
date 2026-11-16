package com.papercache.mobile.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {

    @Query("SELECT * FROM notes WHERE deleted = 0 ORDER BY mtime DESC")
    fun observeActiveNotes(): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE deleted = 1 ORDER BY mtime DESC")
    fun observeTrashedNotes(): Flow<List<Note>>

    @Query(
        "SELECT * FROM notes WHERE deleted = 0 AND " +
            "(path LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%' " +
            "OR tags LIKE '%' || :query || '%') ORDER BY mtime DESC"
    )
    fun search(query: String): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE noteId = :noteId")
    suspend fun get(noteId: String): Note?

    /**
     * Atomic save: a single conditional UPDATE — the note's content is
     * written only while it is still an ACTIVE row. No read-then-write gap:
     * a note trashed or hard-deleted by another coroutine mid-save cannot be
     * resurrected (0 rows affected, treated as a deliberate discard).
     */
    @Query(
        "UPDATE notes SET content = :content, mtime = :mtime " +
            "WHERE noteId = :noteId AND deleted = 0"
    )
    suspend fun saveActiveContent(noteId: String, content: String, mtime: Long): Int

    /**
     * Atomic collision-free rename: the path changes only if the note is
     * active and NO OTHER active note occupies the target path — the
     * existence check lives INSIDE the same statement, so two concurrent
     * renames onto the same free target cannot both win (at most one row is
     * affected).
     */
    @Query(
        "UPDATE notes SET path = :newPath, mtime = :mtime " +
            "WHERE noteId = :noteId AND deleted = 0 AND " +
            "NOT EXISTS (SELECT 1 FROM notes WHERE path = :newPath " +
            "AND deleted = 0 AND noteId != :noteId)"
    )
    suspend fun renameIfFree(noteId: String, newPath: String, mtime: Long): Int

    @Query(
        "SELECT * FROM notes WHERE path = :path AND deleted = 0 AND noteId != :excludeId " +
            "LIMIT 1"
    )
    suspend fun findActiveByPath(path: String, excludeId: String): Note?

    @Query("SELECT path FROM notes WHERE deleted = 0")
    suspend fun activePaths(): List<String>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(note: Note)

    @Query("UPDATE notes SET deleted = 1, mtime = :mtime WHERE noteId = :noteId")
    suspend fun softDelete(noteId: String, mtime: Long)

    /**
     * Atomic collision-free restore: the trashed note becomes ACTIVE again
     * only if no OTHER active note now occupies its path (its path may have
     * been legitimately reused while it was in the trash). The existence
     * check lives INSIDE the same statement — there is no window in which a
     * concurrent path mutation can slip between check and write.
     */
    @Query(
        "UPDATE notes SET deleted = 0, mtime = :mtime " +
            "WHERE noteId = :noteId AND deleted = 1 AND " +
            "NOT EXISTS (SELECT 1 FROM notes n2 WHERE " +
            "n2.path = (SELECT path FROM notes WHERE noteId = :noteId) " +
            "AND n2.deleted = 0 AND n2.noteId != :noteId)"
    )
    suspend fun restoreIfFree(noteId: String, mtime: Long): Int

    @Query("DELETE FROM notes WHERE noteId = :noteId")
    suspend fun hardDelete(noteId: String)
}
