use std::fs;
use std::path::{Path, PathBuf};

use super::detect_conflict;
use crate::sync::hash::sha256_hex;
use crate::sync::index::{rebuild_index, Index};
use crate::sync::revision::{Op, Revision, FORMAT_VERSION};
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
        let meta: VaultMeta = serde_json::from_str(&s).map_err(|e| e.to_string())?;
        if meta.format_version != FORMAT_VERSION {
            return Err(format!("unsupported format_version {}", meta.format_version));
        }
        Ok(meta)
    }

    /// Write an immutable revision record. Idempotent: writing the same
    /// `rev_id` twice is a no-op (the file already exists with identical bytes).
    pub fn write_record(&self, rev: &Revision) -> Result<(), String> {
        self.ensure_layout()?;
        let path = self.records_dir().join(format!("{}.json", rev.rev_id()));
        if path.exists() {
            // A truncated/interrupted write could leave a corrupt file; only
            // treat it as already-present if it parses and matches this rev_id.
            if let Ok(existing) = fs::read_to_string(&path) {
                if let Ok(r) = serde_json::from_str::<Revision>(&existing) {
                    if r.rev_id() == rev.rev_id() {
                        return Ok(());
                    }
                }
            }
        }
        let json = serde_json::to_string(rev).map_err(|e| e.to_string())?;
        atomic_write(&path, json.as_bytes())
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
            // Tolerate individual corrupt records: skip and continue, rather
            // than failing the whole read.
            let Ok(s) = fs::read_to_string(entry.path()) else {
                continue;
            };
            if let Ok(rev) = serde_json::from_str::<Revision>(&s) {
                // Enforce the format-version check and the content-address
                // guarantee (filename must equal the record's rev_id).
                if rev.format_version != FORMAT_VERSION {
                    continue;
                }
                let expected = format!("{}.json", rev.rev_id());
                if entry.file_name().to_string_lossy() != expected.as_str() {
                    continue;
                }
                out.push(rev);
            }
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
        match fs::read_to_string(&path) {
            Ok(s) => match serde_json::from_str::<Index>(&s) {
                Ok(idx) if idx.format_version == FORMAT_VERSION => Ok(idx),
                // Unsupported or corrupt index: recover by replaying records
                // (never assume the file is authoritative).
                _ => {
                    let records = self.read_records()?;
                    Ok(rebuild_index(&records))
                }
            },
            Err(_) => {
                let records = self.read_records()?;
                Ok(rebuild_index(&records))
            }
        }
    }

    pub fn write_note(&self, rel_path: &str, content: &[u8]) -> Result<(), String> {
        let abs = self.safe_note_path(rel_path)?;
        fs::write(&abs, content).map_err(|e| e.to_string())
    }

    pub fn read_note(&self, rel_path: &str) -> Result<Vec<u8>, String> {
        validate_rel_path(rel_path)?;
        fs::read(self.notes_dir().join(rel_path)).map_err(|e| e.to_string())
    }

    pub fn remove_note(&self, rel_path: &str) -> Result<(), String> {
        let abs = self.safe_note_path(rel_path)?;
        if abs.exists() {
            fs::remove_file(&abs).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Move a portable note file, preserving its bytes (atomic rename).
    pub fn rename_note_file(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let src = self.safe_note_path(old_path)?;
        let dst = self.safe_note_path(new_path)?;
        fs::rename(&src, &dst).map_err(|e| e.to_string())
    }

    /// Resolve a note path to a safe absolute path: validate the string, then
    /// canonicalize the parent directory and reject any symlink that escapes
    /// the notes root, and reject a symlink at the final component.
    fn safe_note_path(&self, rel_path: &str) -> Result<PathBuf, String> {
        validate_rel_path(rel_path)?;
        let notes = self.notes_dir();
        fs::create_dir_all(&notes).map_err(|e| e.to_string())?;
        let notes_real = fs::canonicalize(&notes).map_err(|e| e.to_string())?;

        let candidate = notes.join(rel_path);
        let parent = candidate.parent().ok_or("no parent directory")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let parent_real = fs::canonicalize(parent).map_err(|e| e.to_string())?;
        if !parent_real.starts_with(&notes_real) {
            return Err("symlink escapes sync root".to_string());
        }

        let file_name = candidate.file_name().ok_or("no file name")?;
        let final_path = parent_real.join(file_name);
        if let Ok(md) = fs::symlink_metadata(&final_path) {
            if md.file_type().is_symlink() {
                return Err("symlink at target not allowed".to_string());
            }
        }
        Ok(final_path)
    }

    pub fn write_conflict(&self, note_id: &str, rev_id: &str, content: &[u8]) -> Result<(), String> {
        self.ensure_layout()?;
        validate_rel_path(note_id)?;
        validate_rel_path(rev_id)?;
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
        atomic_write(&self.outbox_path(), json.as_bytes())
    }

    /// Remove an acknowledged revision from the outbox (idempotent).
    pub fn ack_outbox(&self, rev_id: &str) -> Result<(), String> {
        let boxed: Vec<Revision> = self
            .read_outbox()?
            .into_iter()
            .filter(|r| r.rev_id() != rev_id)
            .collect();
        self.write_outbox(&boxed)
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
    if segments.iter().any(|s| *s == ".." || s.is_empty() || *s == ".") {
        return Err("path traversal not allowed".to_string());
    }
    Ok(())
}

/// Push a local revision (plus its content for upserts) to the sync root.
/// Idempotent: re-pushing the same revision is a no-op. On a detected fork
/// (our parent != remote head), our content is preserved as a conflict copy so
/// both sides survive. After writing, the index is rebuilt from records.
pub fn push_note(root: &SyncRoot, rev: &Revision, content: &[u8]) -> Result<(), String> {
    if rev.op == Op::Upsert {
        if let Some(hash) = &rev.content_hash {
            if sha256_hex(content) != *hash {
                return Err("content hash mismatch; refusing to push".to_string());
            }
        }
        if rev.content_length != content.len() as u64 {
            return Err("content length mismatch; refusing to push".to_string());
        }
    }

    // Detect a fork before writing and preserve our content so the losing
    // branch is never silently dropped.
    let records = root.read_records()?;
    let index = rebuild_index(&records);
    if rev.op != Op::Delete {
        if let Some(head) = remote_head(&index, &rev.note_id) {
            if detect_conflict(rev.parent_rev.as_deref(), Some(&head)) {
                root.write_conflict(&rev.note_id, &rev.rev_id(), content)?;
            }
        }
    }

    root.write_record(rev)?;
    match rev.op {
        Op::Upsert => root.write_note(&rev.path, content)?,
        Op::Rename => {
            let old = rev.old_path.as_deref().ok_or("rename missing old_path")?;
            root.rename_note_file(old, &rev.path)?;
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

/// Atomic write: write to a temp sibling then rename, so an interrupted write
/// never leaves a truncated file at the destination.
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
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

    #[test]
    fn rename_preserves_bytes_end_to_end() {
        let root = SyncRoot::new(tmp());
        root.init_vault("v1", "2026-01-01T00:00:00.000Z").unwrap();
        let r0 = upsert("n1", None, "notes/a.md", "# original");
        push_note(&root, &r0, b"# original").unwrap();

        let r1 = Revision::rename(
            "n1",
            Some(r0.rev_id()),
            "notes/a.md",
            "notes/b.md",
            "dev",
            "2026-01-01T00:00:01.000Z",
        );
        // Rename must preserve bytes; the caller-supplied content is ignored.
        push_note(&root, &r1, b"IGNORED").unwrap();
        assert_eq!(root.read_note("notes/b.md").unwrap(), b"# original");
        assert!(!root.notes_dir().join("notes/a.md").exists());
    }

    #[test]
    fn corrupt_record_is_skipped_not_fatal() {
        let root = SyncRoot::new(tmp());
        root.ensure_layout().unwrap();
        let good = upsert("n1", None, "a.md", "x");
        root.write_record(&good).unwrap();
        fs::write(root.records_dir().join("zzzz.json"), "{not valid json").unwrap();

        let records = root.read_records().unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].rev_id(), good.rev_id());
    }

    #[test]
    fn record_with_wrong_filename_is_skipped() {
        let root = SyncRoot::new(tmp());
        root.ensure_layout().unwrap();
        let good = upsert("n1", None, "a.md", "x");
        // Write the same record under a wrong filename (not its rev_id).
        let json = serde_json::to_string(&good).unwrap();
        fs::write(root.records_dir().join("not-the-revid.json"), json).unwrap();

        assert!(root.read_records().unwrap().is_empty());
    }

    #[test]
    fn corrupt_index_is_recovered() {
        let root = SyncRoot::new(tmp());
        root.init_vault("v1", "2026-01-01T00:00:00.000Z").unwrap();
        let r0 = upsert("n1", None, "a.md", "x");
        push_note(&root, &r0, b"x").unwrap();
        fs::write(root.sync_dir().join("index.json"), "garbage").unwrap();

        let idx = root.read_index().unwrap();
        assert_eq!(idx.notes["n1"].path, "a.md");
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escape_is_rejected() {
        let root = SyncRoot::new(tmp());
        root.ensure_layout().unwrap();
        let outside = std::env::temp_dir().join(format!("pc-out-{}", std::process::id()));
        fs::create_dir_all(&outside).unwrap();
        let link = root.notes_dir().join("evil");
        std::os::unix::fs::symlink(&outside, &link).unwrap();

        assert!(root.write_note("evil/x.md", b"x").is_err());
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn conflict_note_id_traversal_is_rejected() {
        let root = SyncRoot::new(tmp());
        root.ensure_layout().unwrap();
        assert!(root.write_conflict("../../evil", "rev", b"x").is_err());
    }
}
