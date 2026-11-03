use serde::{Deserialize, Serialize};

use crate::sync::revision::FORMAT_VERSION;

/// Immutable vault identity. Written once per vault; never overwritten by a
/// device once it exists.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct VaultMeta {
    pub format_version: u32,
    pub vault_id: String,
    pub created_at: String,
}

impl VaultMeta {
    pub fn new(vault_id: impl Into<String>, created_at: impl Into<String>) -> Self {
        Self {
            format_version: FORMAT_VERSION,
            vault_id: vault_id.into(),
            created_at: created_at.into(),
        }
    }
}
