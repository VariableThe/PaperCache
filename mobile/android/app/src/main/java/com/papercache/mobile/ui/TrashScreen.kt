package com.papercache.mobile.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.papercache.mobile.data.Note

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrashScreen(vm: NoteViewModel, onBack: () -> Unit) {
    val trashed by vm.trashedNotes.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Trash") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        if (trashed.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Trash is empty")
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(trashed, key = { it.noteId }) { note ->
                    TrashedRow(
                        note = note,
                        onRestore = { vm.restore(note.noteId) },
                        onDeleteForever = { vm.hardDelete(note.noteId) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrashedRow(note: Note, onRestore: () -> Unit, onDeleteForever: () -> Unit) {
    ListItem(
        headlineContent = { Text(note.path) },
        trailingContent = {
            Row {
                IconButton(onClick = onRestore) {
                    Icon(Icons.Filled.Restore, contentDescription = "Restore")
                }
                IconButton(onClick = onDeleteForever) {
                    Icon(Icons.Filled.DeleteForever, contentDescription = "Delete forever")
                }
            }
        },
    )
}
