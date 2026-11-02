pub mod hash;
pub mod index;
pub mod revision;
pub mod vault;

pub use index::{find_conflicts, rebuild_index, Index, NoteState};
pub use revision::{Op, Revision, FORMAT_VERSION};
pub use vault::VaultMeta;

use uuid::Uuid;

pub fn new_vault_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn new_note_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn new_device_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn hash_content(bytes: &[u8]) -> String {
    hash::sha256_hex(bytes)
}

/// Conflict detection between a local edit's base (`local_parent`) and the
/// current remote head. Never uses wall-clock time.
pub fn detect_conflict(local_parent: Option<&str>, remote_head: Option<&str>) -> bool {
    match (local_parent, remote_head) {
        // Remote has no record for this note; fast-forward.
        (_, None) => false,
        // Both have a base; conflict iff they diverge.
        (Some(local), Some(remote)) => local != remote,
        // We believe the note is new but it already exists remotely.
        (None, Some(_)) => true,
    }
}

#[cfg(test)]
mod tests;
