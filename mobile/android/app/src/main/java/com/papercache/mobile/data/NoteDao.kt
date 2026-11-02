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

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(note: Note)

    @Query("UPDATE notes SET deleted = 1, mtime = :mtime WHERE noteId = :noteId")
    suspend fun softDelete(noteId: String, mtime: Long)

    @Query("UPDATE notes SET deleted = 0, mtime = :mtime WHERE noteId = :noteId")
    suspend fun restore(noteId: String, mtime: Long)

    @Query("DELETE FROM notes WHERE noteId = :noteId")
    suspend fun hardDelete(noteId: String)

    @Query("UPDATE notes SET path = :newPath, mtime = :mtime WHERE noteId = :noteId")
    suspend fun rename(noteId: String, newPath: String, mtime: Long)
}
