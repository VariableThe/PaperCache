package com.papercache.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.papercache.mobile.data.Note
import com.papercache.mobile.data.NoteRepository
import com.papercache.mobile.util.Autosave
import java.util.UUID
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class NoteViewModel(private val repo: NoteRepository) : ViewModel() {

    val activeNotes: StateFlow<List<Note>> =
        repo.activeNotes.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val trashedNotes: StateFlow<List<Note>> =
        repo.trashedNotes.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    @OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
    val searchResults: StateFlow<List<Note>> =
        _searchQuery
            .debounce(200)
            .flatMapLatest { q -> if (q.isBlank()) repo.activeNotes else repo.search(q) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Editor state
    private val _editingNoteId = MutableStateFlow<String?>(null)
    val editingNoteId: StateFlow<String?> = _editingNoteId.asStateFlow()

    private val _editorContent = MutableStateFlow("")
    val editorContent: StateFlow<String> = _editorContent.asStateFlow()

    private val _editorPath = MutableStateFlow("")
    val editorPath: StateFlow<String> = _editorPath.asStateFlow()

    private val _saveStatus = MutableStateFlow("")
    val saveStatus: StateFlow<String> = _saveStatus.asStateFlow()

    val autosave = Autosave(viewModelScope) { id, content ->
        try {
            // A single conditional UPDATE: the content lands only while the
            // row is still ACTIVE. A note trashed or hard-deleted while this
            // save was queued/in flight is NOT resurrected — the save simply
            // reports the discard. (A read-then-upsert would have a window in
            // which a stale ACTIVE snapshot could overwrite the delete.)
            val saved = repo.saveActiveContent(id, content, System.currentTimeMillis())
            _saveStatus.value = if (saved) "Saved" else "Note deleted"
        } catch (e: Exception) {
            _saveStatus.value = "Save failed — retrying"
            throw e
        }
    }

    fun setSearchQuery(q: String) {
        _searchQuery.value = q
    }

    fun openNote(noteId: String) {
        viewModelScope.launch {
            repo.get(noteId)?.let { n ->
                _editingNoteId.value = n.noteId
                _editorContent.value = n.content
                _editorPath.value = n.path
                _saveStatus.value = ""
            }
        }
    }

    fun closeEditor() {
        autosave.flush()
        _editingNoteId.value = null
        _editorContent.value = ""
        _editorPath.value = ""
        _saveStatus.value = ""
    }

    fun onEditorChange(content: String) {
        _editorContent.value = content
        val id = _editingNoteId.value ?: return
        _saveStatus.value = "Saving…"
        autosave.schedule(id, content)
    }

    fun createNote() {
        val noteId = UUID.randomUUID().toString()
        viewModelScope.launch {
            // Collision-free default path, serialized against concurrent
            // creates: never two live notes on the same path (they would be
            // the same vault file once sync lands).
            repo.createUntitled(noteId, "", System.currentTimeMillis())
            openNote(noteId)
        }
    }

    fun renameNote(newPath: String) {
        val id = _editingNoteId.value ?: return
        val safePath = if (newPath.endsWith(".md")) newPath else "$newPath.md"
        viewModelScope.launch {
            // Refused when another live note already has this path; both
            // notes (and any pending autosave) stay untouched and retryable.
            val renamed = repo.renameIfFree(id, safePath, System.currentTimeMillis())
            if (renamed) {
                _editorPath.value = safePath
                _saveStatus.value = ""
            } else {
                _saveStatus.value = "A note with that name already exists"
            }
        }
    }

    fun trashCurrent() {
        val id = _editingNoteId.value ?: return
        viewModelScope.launch {
            try {
                repo.softDelete(id, System.currentTimeMillis())
                // The trash SUCCEEDED: only now are the queued autosave
                // bytes discarded deliberately (and a save still in flight
                // is a conditional UPDATE that finds no active row — it
                // cannot resurrect the note). Cancelling BEFORE the delete
                // would discard the user's pending edit even when the
                // delete fails.
                autosave.cancel(id)
                _editingNoteId.value = null
                _editorContent.value = ""
                _editorPath.value = ""
                _saveStatus.value = ""
            } catch (e: Exception) {
                // The delete failed: keep the editor open and the pending
                // edit queued — nothing is lost, the user can retry.
                _saveStatus.value = "Move to trash failed"
            }
        }
    }

    fun softDelete(noteId: String) {
        viewModelScope.launch {
            try {
                repo.softDelete(noteId, System.currentTimeMillis())
                autosave.cancel(noteId)
            } catch (e: Exception) {
                _saveStatus.value = "Move to trash failed"
            }
        }
    }

    fun restore(noteId: String) {
        viewModelScope.launch {
            // Refused when another active note now holds the trashed note's
            // path (it may have been reused while the note was in the trash).
            // The note then stays in the trash, recoverable once freed.
            if (!repo.restore(noteId, System.currentTimeMillis())) {
                _saveStatus.value = "A note with that name already exists"
            }
        }
    }

    fun hardDelete(noteId: String) {
        viewModelScope.launch {
            try {
                repo.hardDelete(noteId)
                // The permanent delete SUCCEEDED: the queued autosave bytes
                // go with it (and a save still in flight is a conditional
                // UPDATE that finds no row — it cannot resurrect the note).
                autosave.cancel(noteId)
            } catch (e: Exception) {
                // The delete failed: the note and any pending edit survive.
                _saveStatus.value = "Delete failed"
            }
        }
    }

    companion object {
        fun factory(repo: NoteRepository): ViewModelProvider.Factory = viewModelFactory {
            initializer { NoteViewModel(repo) }
        }
    }
}
