use serde::{Deserialize, Serialize};

use crate::sync::hash::sha256_hex;

/// The sync protocol format version understood by this build.
pub const FORMAT_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Op {
    Upsert,
    Rename,
    Delete,
}

/// An immutable revision record. Field order is part of the canonical form used
/// to compute `rev_id`, so keep the declaration order stable.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Revision {
    pub format_version: u32,
    pub note_id: String,
    pub parent_rev: Option<String>,
    pub op: Op,
    pub path: String,
    pub old_path: Option<String>,
    pub content_hash: Option<String>,
    pub content_length: u64,
    pub device_id: String,
    pub created_at: String,
}

impl Revision {
    /// The content address of this record: SHA-256 of its canonical JSON.
    pub fn rev_id(&self) -> String {
        let json = serde_json::to_string(self).expect("revision must serialize");
        sha256_hex(json.as_bytes())
    }

    pub fn upsert(
        note_id: impl Into<String>,
        parent_rev: Option<String>,
        path: impl Into<String>,
        content_hash: impl Into<String>,
        content_length: u64,
        device_id: impl Into<String>,
        created_at: impl Into<String>,
    ) -> Self {
        Self {
            format_version: FORMAT_VERSION,
            note_id: note_id.into(),
            parent_rev,
            op: Op::Upsert,
            path: path.into(),
            old_path: None,
            content_hash: Some(content_hash.into()),
            content_length,
            device_id: device_id.into(),
            created_at: created_at.into(),
        }
    }

    pub fn rename(
        note_id: impl Into<String>,
        parent_rev: Option<String>,
        old_path: impl Into<String>,
        new_path: impl Into<String>,
        device_id: impl Into<String>,
        created_at: impl Into<String>,
    ) -> Self {
        Self {
            format_version: FORMAT_VERSION,
            note_id: note_id.into(),
            parent_rev,
            op: Op::Rename,
            path: new_path.into(),
            old_path: Some(old_path.into()),
            content_hash: None,
            content_length: 0,
            device_id: device_id.into(),
            created_at: created_at.into(),
        }
    }

    pub fn delete(
        note_id: impl Into<String>,
        parent_rev: Option<String>,
        path: impl Into<String>,
        device_id: impl Into<String>,
        created_at: impl Into<String>,
    ) -> Self {
        Self {
            format_version: FORMAT_VERSION,
            note_id: note_id.into(),
            parent_rev,
            op: Op::Delete,
            path: path.into(),
            old_path: None,
            content_hash: None,
            content_length: 0,
            device_id: device_id.into(),
            created_at: created_at.into(),
        }
    }
}
