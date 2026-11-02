package com.papercache.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.papercache.mobile.data.AppDatabase
import com.papercache.mobile.data.NoteRepository
import com.papercache.mobile.ui.EditorScreen
import com.papercache.mobile.ui.NoteListScreen
import com.papercache.mobile.ui.NoteViewModel
import com.papercache.mobile.ui.TrashScreen
import com.papercache.mobile.ui.theme.PaperCacheTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val repo = NoteRepository(AppDatabase.get(this).noteDao())
        setContent {
            PaperCacheTheme {
                val vm: NoteViewModel = viewModel(factory = NoteViewModel.factory(repo))
                App(vm)
            }
        }
    }
}

@Composable
private fun App(vm: NoteViewModel) {
    val editingId by vm.editingNoteId.collectAsState()
    var showTrash by remember { mutableStateOf(false) }

    when {
        editingId != null -> EditorScreen(vm, onBack = { vm.closeEditor() })
        showTrash -> TrashScreen(vm, onBack = { showTrash = false })
        else -> NoteListScreen(vm, onOpenTrash = { showTrash = true })
    }
}
