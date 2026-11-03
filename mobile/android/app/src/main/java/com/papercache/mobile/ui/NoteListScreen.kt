package com.papercache.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.papercache.mobile.data.Note
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteListScreen(
    vm: NoteViewModel,
    onOpenTrash: () -> Unit,
) {
    val query by vm.searchQuery.collectAsState()
    val results by vm.searchResults.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("PaperCache") },
                actions = {
                    IconButton(onClick = onOpenTrash) {
                        Icon(Icons.Filled.Delete, contentDescription = "Open trash")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { vm.createNote() }) {
                Icon(Icons.Filled.Add, contentDescription = "New note")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = vm::setSearchQuery,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search notes") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            )

            if (results.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(if (query.isBlank()) "No notes yet. Tap + to create one." else "No matches.")
                }
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(results, key = { it.noteId }) { note ->
                        NoteRow(
                            note = note,
                            onOpen = { vm.openNote(note.noteId) },
                            onTrash = {
                                vm.softDelete(note.noteId)
                                scope.launch {
                                    val r = snackbarHostState.showSnackbar(
                                        message = "Moved to trash",
                                        actionLabel = "Undo",
                                    )
                                    if (r == SnackbarResult.ActionPerformed) {
                                        vm.restore(note.noteId)
                                    }
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteRow(note: Note, onOpen: () -> Unit, onTrash: () -> Unit) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) onTrash()
            false
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.errorContainer),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = null,
                    modifier = Modifier.padding(end = 24.dp),
                )
            }
        },
    ) {
        ListItem(
            headlineContent = { Text(note.path, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            supportingContent = {
                Column {
                    Text(
                        note.content.lineSequence().firstOrNull().orEmpty(),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    val tags = extractTags(note.content)
                    if (tags.isNotEmpty()) {
                        Text(
                            text = tags.joinToString("  ") { "!$it" },
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF3B82F6),
                        )
                    }
                }
            },
            trailingContent = {
                IconButton(onClick = onTrash) {
                    Icon(Icons.Filled.Delete, contentDescription = "Trash note")
                }
            },
            modifier = Modifier.clickable(onClick = onOpen),
        )
    }
}

private val TAG_REGEX = Regex("!([a-zA-Z0-9_-]+)")

private fun extractTags(content: String): List<String> =
    TAG_REGEX.findAll(content).map { it.groupValues[1] }.distinct().toList()
