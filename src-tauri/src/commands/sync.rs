use crate::sync::engine::{self, SyncRoot};
use crate::sync::revision::Revision;
use crate::sync::{hash_content, new_device_id, new_vault_id};

/// RFC 3339 UTC with millisecond precision (the canonical `created_at` format).
fn now_rfc3339() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// A stable per-installation device id, persisted under `~/.papercache`.
fn device_id() -> Result<String, String> {
    let mut dir = dirs::home_dir().ok_or("no home directory")?;
    dir.push(".papercache");
    dir.push(".papercache-sync");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("device.json");
    if let Ok(s) = std::fs::read_to_string(&path) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            if let Some(id) = v.get("device_id").and_then(|x| x.as_str()) {
                return Ok(id.to_string());
            }
        }
    }
    let id = new_device_id();
    std::fs::write(&path, serde_json::json!({ "device_id": id }).to_string())
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[derive(serde::Serialize)]
pub struct PulledNote {
    pub note_id: String,
    pub path: String,
    pub content: String,
    pub deleted: bool,
}

/// Initialize a sync folder as a PaperCache vault; returns the `vault_id`.
#[tauri::command]
pub fn sync_init_folder(folder_path: String) -> Result<String, String> {
    let root = SyncRoot::new(folder_path);
    let vault_id = new_vault_id();
    root.init_vault(&vault_id, &now_rfc3339())?;
    Ok(vault_id)
}

/// Push a note as an `upsert` revision into the sync folder; returns `rev_id`.
#[tauri::command]
pub fn sync_push_note(
    folder_path: String,
    note_id: String,
    path: String,
    content: String,
    parent_rev: Option<String>,
) -> Result<String, String> {
    let root = SyncRoot::new(folder_path);
    let bytes = content.as_bytes();
    let rev = Revision::upsert(
        note_id,
        parent_rev,
        path,
        hash_content(bytes),
        bytes.len() as u64,
        device_id()?,
        now_rfc3339(),
    );
    engine::push_note(&root, &rev, bytes)?;
    Ok(rev.rev_id())
}

/// Pull the current view of the vault: portable notes plus their identity.
#[tauri::command]
pub fn sync_pull_notes(folder_path: String) -> Result<Vec<PulledNote>, String> {
    let root = SyncRoot::new(folder_path);
    let (_records, index) = engine::pull(&root)?;
    let mut out = Vec::new();
    for (note_id, state) in index.notes {
        let content = if state.deleted {
            String::new()
        } else {
            match root.read_note(&state.path) {
                Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
                Err(_) => String::new(),
            }
        };
        out.push(PulledNote {
            note_id,
            path: state.path,
            content,
            deleted: state.deleted,
        });
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}
