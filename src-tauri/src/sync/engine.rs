use std::fs;
use std::path::{Path, PathBuf};

use crate::sync::hash::sha256_hex;
use crate::sync::index::{rebuild_index, Index};
use crate::sync::revision::{Op, Revision};
use crate::sync::vault::VaultMeta;

pub const SYNC_DIR: &str = ".papercache-sync";
pub const RECORDS_DIR: &str = "records";
pub const NOTES_DIR: &str = "notes";
pub const CONFLICTS_DIR: &str = "conflicts";
pub const OUTBOX_FILE: &str = "outbox.json";

/// A provider-agnostic sync root. Every provider (Syncthing folder, Nextcloud
/// WebDAV folder, Google Drive folder) exposes the same on-disk layout; this
/// module is the folder-provider implementation of it.
#[derive(Clone, Debug)]
pub struct SyncRoot {
    pub root: PathBuf,
}

impl SyncRoot {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn sync_dir(&self) -> PathBuf {
        self.root.join(SYNC_DIR)
    }
    pub fn records_dir(&self) -> PathBuf {
        self.sync_dir().join(RECORDS_DIR)
    }
    pub fn notes_dir(&self) -> PathBuf {
        self.root.join(NOTES_DIR)
    }
    pub fn conflicts_dir(&self) -> PathBuf {
        self.sync_dir().join(CONFLICTS_DIR)
    }

    pub fn ensure_layout(&self) -> Result<(), String> {
        for dir in [self.records_dir(), self.notes_dir(), self.conflicts_dir()] {
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn init_vault(&self, vault_id: &str, created_at: &str) -> Result<(), String> {
        self.ensure_layout()?;
        let path = self.root.join("vault.json");
        if path.exists() {
            let existing: VaultMeta = serde_json::from_str(
                &fs::read_to_string(&path).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            if existing.vault_id != vault_id {
                return Err("vault_id mismatch; refusing to overwrite".to_string());
            }
            return Ok(());
        }
        let meta = VaultMeta::new(vault_id, created_at);
        fs::write(&path, serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())
    }

    pub fn read_vault(&self) -> Result<VaultMeta, String> {
        let path = self.root.join("vault.json");
        let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).map_err(|e| e.to_string())
    }

    /// Write an immutable revision record. Idempotent: writing the same
    /// `rev_id` twice is a no-op (the file already exists with identical bytes).
    pub fn write_record(&self, rev: &Revision) -> Result<(), String> {
        self.ensure_layout()?;
        let path = self.records_dir().join(format!("{}.json", rev.rev_id()));
        if path.exists() {
            return Ok(());
        }
        let json = serde_json::to_string(rev).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())
    }

    pub fn read_records(&self) -> Result<Vec<Revision>, String> {
        let dir = self.records_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.path().extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let s = fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
            out.push(serde_json::from_str(&s).map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    pub fn write_index(&self, index: &Index) -> Result<(), String> {
        self.ensure_layout()?;
        let path = self.sync_dir().join("index.json");
        let json = serde_json::to_string(index).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())
    }

    pub fn read_index(&self) -> Result<Index, String> {
        let path = self.sync_dir().join("index.json");
        if !path.exists() {
            return Ok(Index::default());
        }
        let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).map_err(|e| e.to_string())
    }

    pub fn write_note(&self, rel_path: &str, content: &[u8]) -> Result<(), String> {
        validate_rel_path(rel_path)?;
        let abs = self.notes_dir().join(rel_path);
        if let Some(parent) = abs.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&abs, content).map_err(|e| e.to_string())
    }

    pub fn read_note(&self, rel_path: &str) -> Result<Vec<u8>, String> {
        validate_rel_path(rel_path)?;
        fs::read(self.notes_dir().join(rel_path)).map_err(|e| e.to_string())
    }

    pub fn remove_note(&self, rel_path: &str) -> Result<(), String> {
        validate_rel_path(rel_path)?;
        let abs = self.notes_dir().join(rel_path);
        if abs.exists() {
            fs::remove_file(&abs).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn write_conflict(&self, note_id: &str, rev_id: &str, content: &[u8]) -> Result<(), String> {
        self.ensure_layout()?;
        let dir = self.conflicts_dir().join(note_id);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("{}.md", rev_id)), content).map_err(|e| e.to_string())
    }

    // Outbox (durable queue of local revisions not yet pushed).

    pub fn outbox_path(&self) -> PathBuf {
        self.sync_dir().join(OUTBOX_FILE)
    }

    pub fn enqueue(&self, rev: &Revision) -> Result<(), String> {
        self.ensure_layout()?;
        let mut boxed = self.read_outbox()?;
        if !boxed.iter().any(|r| r.rev_id() == rev.rev_id()) {
            boxed.push(rev.clone());
        }
        self.write_outbox(&boxed)
    }

    pub fn read_outbox(&self) -> Result<Vec<Revision>, String> {
        let path = self.outbox_path();
        if !path.exists() {
            return Ok(Vec::new());
        }
        let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).map_err(|e| e.to_string())
    }

    pub fn write_outbox(&self, boxed: &[Revision]) -> Result<(), String> {
        let json = serde_json::to_string(boxed).map_err(|e| e.to_string())?;
        fs::write(self.outbox_path(), json).map_err(|e| e.to_string())
    }
}

/// Reject paths that could escape the sync root. Vault-relative, `/`-separated.
pub fn validate_rel_path(p: &str) -> Result<(), String> {
    if p.is_empty() {
        return Err("empty path".to_string());
    }
    if p.contains('\0') {
        return Err("NUL byte in path".to_string());
    }
    if p.contains('\\') {
        return Err("backslash not allowed".to_string());
    }
    if Path::new(p).is_absolute() {
        return Err("absolute path not allowed".to_string());
    }
    let segments: Vec<&str> = p.split('/').collect();
    if segments.iter().any(|s| *s == "..") {
        return Err("path traversal not allowed".to_string());
    }
    Ok(())
}

/// Push a local revision (plus its content for upserts) to the sync root.
/// Idempotent: re-pushing the same revision is a no-op. After writing, the
/// index is rebuilt from records and written back.
pub fn push_note(root: &SyncRoot, rev: &Revision, content: &[u8]) -> Result<(), String> {
    if let Some(hash) = &rev.content_hash {
        if sha256_hex(content) != *hash {
            return Err("content hash mismatch; refusing to push".to_string());
        }
    }

    root.write_record(rev)?;
    match rev.op {
        Op::Upsert => root.write_note(&rev.path, content)?,
        Op::Rename => {
            if let Some(old) = &rev.old_path {
                root.remove_note(old)?;
            }
            root.write_note(&rev.path, content)?;
        }
        Op::Delete => root.remove_note(&rev.path)?,
    }

    let records = root.read_records()?;
    let index = rebuild_index(&records);
    root.write_index(&index)
}

/// Pull the current view: all records plus the rebuilt index.
pub fn pull(root: &SyncRoot) -> Result<(Vec<Revision>, Index), String> {
    let records = root.read_records()?;
    let index = rebuild_index(&records);
    Ok((records, index))
}

/// Reconcile a local revision against the current remote head for the note.
/// Returns the remote head `rev_id` (if any) so the caller can detect a fork.
pub fn remote_head(index: &Index, note_id: &str) -> Option<String> {
    index.notes.get(note_id).map(|s| s.head_rev.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::revision::Revision;

    fn tmp() -> PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("pc-sync-{}-{}", std::process::id(), n));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn upsert(note_id: &str, parent: Option<String>, path: &str, content: &str) -> Revision {
        Revision::upsert(
            note_id,
            parent,
            path,
            sha256_hex(content.as_bytes()),
            content.len() as u64,
            "dev",
            "2026-01-01T00:00:00.000Z",
        )
    }

    #[test]
    fn init_vault_is_idempotent_and_rejects_mismatch() {
        let root = SyncRoot::new(tmp());
        root.init_vault("v1", "2026-01-01T00:00:00.000Z").unwrap();
        root.init_vault("v1", "2026-01-01T00:00:00.000Z").unwrap();
        assert_eq!(root.read_vault().unwrap().vault_id, "v1");
        assert!(root.init_vault("v2", "2026-01-01T00:00:00.000Z").is_err());
    }

    #[test]
    fn write_record_is_idempotent() {
        let root = SyncRoot::new(tmp());
        root.ensure_layout().unwrap();
        let rev = upsert("n1", None, "a.md", "hello");
        root.write_record(&rev).unwrap();
        root.write_record(&rev).unwrap();
        let records = root.read_records().unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].rev_id(), rev.rev_id());
    }

    #[test]
    fn push_note_writes_portable_markdown_and_rebuilds_index() {
        let root = SyncRoot::new(tmp());
        root.init_vault("v1", "2026-01-01T00:00:00.000Z").unwrap();
        let rev = upsert("n1", None, "notes/hello.md", "# hi");
        push_note(&root, &rev, "# hi".as_bytes()).unwrap();

        // Portable markdown is written at notes/<path>.
        assert_eq!(root.read_note("notes/hello.md").unwrap(), b"# hi");
        // Index reflects the note.
        let (_records, index) = pull(&root).unwrap();
        assert_eq!(index.notes["n1"].path, "notes/hello.md");
    }

    #[test]
    fn push_note_rejects_content_hash_mismatch() {
        let root = SyncRoot::new(tmp());
        root.ensure_layout().unwrap();
        let rev = upsert("n1", None, "a.md", "correct");
        assert!(push_note(&root, &rev, b"wrong content").is_err());
    }

    #[test]
    fn delete_removes_note_and_marks_tombstone() {
        let root = SyncRoot::new(tmp());
        root.init_vault("v1", "2026-01-01T00:00:00.000Z").unwrap();
        let r0 = upsert("n1", None, "a.md", "x");
        push_note(&root, &r0, b"x").unwrap();

        let r1 = Revision::delete(
            "n1",
            Some(r0.rev_id()),
            "a.md",
            "dev",
            "2026-01-01T00:00:01.000Z",
        );
        push_note(&root, &r1, b"").unwrap();

        assert!(!root.notes_dir().join("a.md").exists());
        let (_records, index) = pull(&root).unwrap();
        assert!(index.notes["n1"].deleted);
    }

    #[test]
    fn path_validation_rejects_traversal() {
        for bad in ["../x.md", "a/../../b.md", "/abs.md", "a\\b.md", "a\0b.md", ""] {
            assert!(validate_rel_path(bad).is_err(), "should reject {bad:?}");
        }
        assert!(validate_rel_path("notes/a.md").is_ok());
    }

    #[test]
    fn outbox_preserves_pending_revisions() {
        let root = SyncRoot::new(tmp());
        let rev = upsert("n1", None, "a.md", "x");
        root.enqueue(&rev).unwrap();
        root.enqueue(&rev).unwrap(); // dedup
        assert_eq!(root.read_outbox().unwrap().len(), 1);
    }
}
