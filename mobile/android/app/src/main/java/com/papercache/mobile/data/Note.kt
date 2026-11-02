package com.papercache.mobile.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A note. `noteId` is a stable UUID (matching the sync protocol's `note_id`),
 * independent of `path`, which is the vault-relative markdown path and changes
 * on rename. `tags` is a comma-separated string for simplicity.
 */
@Entity(tableName = "notes")
data class Note(
    @PrimaryKey val noteId: String,
    val path: String,
    val content: String,
    val mtime: Long,
    val deleted: Boolean = false,
    val tags: String = "",
)
