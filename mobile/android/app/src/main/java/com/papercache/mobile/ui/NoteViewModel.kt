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

    private val _editorTags = MutableStateFlow("")
    val editorTags: StateFlow<String> = _editorTags.asStateFlow()

    private val _saveStatus = MutableStateFlow("")
    val saveStatus: StateFlow<String> = _saveStatus.asStateFlow()

    val autosave = Autosave(viewModelScope) { id, content ->
        viewModelScope.launch {
            repo.get(id)?.let { existing ->
                repo.upsert(existing.copy(content = content, mtime = System.currentTimeMillis()))
                _saveStatus.value = "Saved"
            }
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
                _editorTags.value = n.tags
                _saveStatus.value = ""
            }
        }
    }

    fun closeEditor() {
        autosave.flush()
        _editingNoteId.value = null
        _editorContent.value = ""
        _editorPath.value = ""
        _editorTags.value = ""
        _saveStatus.value = ""
    }

    fun onEditorChange(content: String) {
        _editorContent.value = content
        val id = _editingNoteId.value ?: return
        _saveStatus.value = "Saving…"
        autosave.schedule(id, content)
    }

    fun onTagsChange(tags: String) {
        _editorTags.value = tags
        val id = _editingNoteId.value ?: return
        viewModelScope.launch {
            repo.get(id)?.let { repo.upsert(it.copy(tags = tags, mtime = System.currentTimeMillis())) }
        }
    }

    fun createNote() {
        val noteId = UUID.randomUUID().toString()
        val note = Note(
            noteId = noteId,
            path = "Untitled.md",
            content = "",
            mtime = System.currentTimeMillis(),
        )
        viewModelScope.launch {
            repo.upsert(note)
            openNote(noteId)
        }
    }

    fun renameNote(newPath: String) {
        val id = _editingNoteId.value ?: return
        val safePath = if (newPath.endsWith(".md")) newPath else "$newPath.md"
        viewModelScope.launch {
            repo.rename(id, safePath, System.currentTimeMillis())
            _editorPath.value = safePath
        }
    }

    fun trashCurrent() {
        val id = _editingNoteId.value ?: return
        viewModelScope.launch {
            repo.softDelete(id, System.currentTimeMillis())
            _editingNoteId.value = null
        }
    }

    fun softDelete(noteId: String) {
        viewModelScope.launch { repo.softDelete(noteId, System.currentTimeMillis()) }
    }

    fun restore(noteId: String) {
        viewModelScope.launch { repo.restore(noteId, System.currentTimeMillis()) }
    }

    fun hardDelete(noteId: String) {
        viewModelScope.launch { repo.hardDelete(noteId) }
    }

    companion object {
        fun factory(repo: NoteRepository): ViewModelProvider.Factory = viewModelFactory {
            initializer { NoteViewModel(repo) }
        }
    }
}
