package com.papercache.mobile.data

import kotlinx.coroutines.flow.Flow

class NoteRepository(private val dao: NoteDao) {

    val activeNotes: Flow<List<Note>> = dao.observeActiveNotes()
    val trashedNotes: Flow<List<Note>> = dao.observeTrashedNotes()

    fun search(query: String): Flow<List<Note>> = dao.search(query)

    suspend fun get(noteId: String): Note? = dao.get(noteId)

    suspend fun upsert(note: Note) = dao.upsert(note)

    suspend fun softDelete(noteId: String, mtime: Long) = dao.softDelete(noteId, mtime)

    suspend fun restore(noteId: String, mtime: Long) = dao.restore(noteId, mtime)

    suspend fun hardDelete(noteId: String) = dao.hardDelete(noteId)

    suspend fun rename(noteId: String, newPath: String, mtime: Long) =
        dao.rename(noteId, newPath, mtime)
}
