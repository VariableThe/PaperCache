# PaperCache Sync Protocol — Format Version 1

This document defines the single, versioned sync contract shared by the desktop
app and the Android app (and any future clients). It is intentionally small,
provider-agnostic, and testable with static fixtures. No client is allowed to
implement its own divergent sync representation.

## 1. Goals and non-goals

Goals:

- Stable vault and note identities that are independent of filenames.
- Markdown path mapping, including correct rename handling.
- Revision ancestry and content hashes for causal reasoning.
- Durable outbox/retries and deletion tombstones.
- Conflict preservation for `edit/edit`, `rename/edit`, and `delete/edit` races.
- Idempotent replay and safe recovery after interruption.
- Portable asset references and asset-transfer rules.
- Explicit format-version compatibility checks.

Non-goals (explicitly out of scope for the wire format):

- Wall-clock `mtime` is **never** used to choose a winner. Timestamps are
  informational only.
- A live SQLite database file is **never** synced.
- A single mutable whole-vault manifest that every device overwrites is **never**
  used as the source of truth. The index is rebuildable from immutable records.

## 2. Identities

### Vault

- `vault_id` — a UUIDv4, generated once when a vault is first created. It is the
  stable identifier for the whole synchronized unit.
- The vault is identified on the remote by `vault.json` (see §4). Two devices are
  in the same vault if and only if their `vault_id` matches.

### Note

- `note_id` — a UUIDv4, stable for the lifetime of a note. Renaming a note changes
  its **path** but never its `note_id`.
- The mapping `note_id ↔ relative path` is stored in the rebuildable index
  (`index.json`, see §5). It is derived, not the source of truth.

### Device

- `device_id` — a UUIDv4, generated once per installation, stored locally (not
  synced). It is recorded on each revision for attribution and conflict-copy
  naming only.

### Revision

- `rev_id` — the SHA-256 of the canonical JSON serialization of the revision
  record (with the `rev_id` field excluded). Records are content-addressed and
  immutable; re-uploading the same record is a no-op (idempotency).

## 3. Revision records

A revision record is an immutable JSON object. Field order is part of the
canonical form used to compute `rev_id`:

```json
{
  "format_version": 1,
  "note_id": "uuid",
  "parent_rev": "sha256 | null",
  "op": "upsert | rename | delete",
  "path": "relative/path.md",
  "old_path": null,
  "content_hash": "sha256 | null",
  "content_length": 0,
  "device_id": "uuid",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

Field semantics:

- `format_version` — the protocol format version. A client MUST refuse to
  operate on a vault whose `format_version` it does not understand (see §7).
- `note_id` — the stable note identity this record affects.
- `parent_rev` — the `rev_id` of this note's previous head, or `null` for the
  first revision. This is the causal/ancestry link.
- `op` — the operation:
  - `upsert` — create or update. `path` is the canonical path, `content_hash`
    is the SHA-256 of the note body bytes, `content_length` its byte length.
  - `rename` — `old_path` is the previous path, `path` is the new path.
    `content_hash` is `null`.
  - `delete` — a tombstone. `path` is the deleted path. `content_hash` is `null`.
- `path` — the vault-relative path of the note (forward slashes, `.md` suffix).
  Paths are relative to the sync root and MUST NOT contain `..` or start with `/`.
- `old_path` — set only for `rename`.
- `content_hash` — SHA-256 hex of the note body bytes (UTF-8, no trailing
  newline normalization). `null` for `rename` and `delete`.
- `device_id` / `created_at` — attribution and ordering hints only. `created_at`
  MUST NOT be used to break ties.

### Canonical serialization

`rev_id = sha256(canonical_json(record_without_rev_id))`.

`canonical_json` is the UTF-8 encoding of `serde_json::to_string` of a struct with
the field order shown above, with no map-key reordering (all fields are fixed
struct fields, so ordering is deterministic). Implementations in other languages
MUST reproduce this byte-for-byte (see fixtures).

## 4. Sync directory layout

The sync root is a provider-agnostic directory tree. Every provider (Syncthing
folder, Nextcloud WebDAV folder, Google Drive folder) exposes the same layout:

```
<root>/
  vault.json
  notes/
    <relative/path>.md
    ...
  .images/
    ...
  .audio/
    ...
  .papercache-sync/
    index.json
    records/
      <rev_id>.json
    conflicts/
      <note_id>/<rev_id>.md
```

- `vault.json` — `{ "format_version": 1, "vault_id": "...", "created_at": "..." }`.
  Written once; never overwritten by a device once it exists (a mismatch is a
  hard error, not a silent replacement).
- `notes/` — portable, human-readable Markdown. The current content of each
  non-deleted note. This is the *portable* view; a desktop install can read these
  files directly without the app.
- `.images/` and `.audio/` — portable asset files referenced by notes via
  `/.images/...` and `/.audio/...` paths.
- `.papercache-sync/index.json` — the rebuildable index (see §5).
- `.papercache-sync/records/<rev_id>.json` — immutable, append-only revision
  records. Never edited; a device only adds records.
- `.papercache-sync/conflicts/` — human-readable conflict copies (see §6).

The local on-disk note store (e.g. `~/.papercache`) keeps its own copy of the
notes at their relative paths; the sync root is a separate projection of the
same vault.

## 5. The rebuildable index

`index.json` maps each `note_id` to its current state:

```json
{
  "format_version": 1,
  "notes": {
    "<note_id>": {
      "path": "relative/path.md",
      "head_rev": "sha256",
      "content_hash": "sha256",
      "deleted": false
    }
  }
}
```

The index is **derived** and can be rebuilt at any time by replaying all revision
records in causal order (following `parent_rev` links from each `null` root).
Rules:

- `upsert` sets `path`, `head_rev`, `content_hash`, `deleted: false`.
- `rename` updates `path` and `head_rev`.
- `delete` sets `deleted: true` and `head_rev`, and removes the live note file.

A missing or corrupt `index.json` is recovered by replaying `records/` — it is
never assumed to be authoritative and never the thing that loses data.

## 6. Writing, conflicts, and tombstones

### Writing (local editing is authoritative and immediate)

1. Editing a note locally is applied to the local file immediately. It does not
   wait for the network.
2. A new `upsert` revision is created with `parent_rev` = the current local head.
3. The revision is appended to the local outbox and pushed (with retries).

### Fast-forward vs. conflict

Before a device writes to the remote, it reads the remote head for the note:

- If the remote head equals the local `parent_rev`, the write fast-forwards
  cleanly.
- If the remote head differs (a concurrent edit on another device), the two
  revisions fork. This is a **conflict**:

  - **edit/edit** — the incoming content is preserved in
    `.papercache-sync/conflicts/<note_id>/<rev_id>.md` and surfaced to the user as
    a conflict copy. The local edit remains authoritative on the local device and
    is still pushed as a child of the remote head (both branches survive).
  - **rename/edit** — the rename changes `path`; a concurrent edit to the same
    note is preserved against the new path, never lost.
  - **delete/edit** — an edit racing a `delete` is preserved as a conflict copy;
    the tombstone and the edit both survive. A client does not resurrect a note
    that has a tombstone unless the user explicitly resolves the conflict.

No conflict resolution silently discards either side. Both sides remain in the
record graph and, where they cannot both be the live file, a conflict copy holds
the non-live side.

### Tombstones and deletion safety

- A `delete` writes an immutable tombstone record (`op: "delete"`). Deletions
  propagate **only** through tombstones.
- Losing network access, credentials, folder permission, or receiving a partial
  listing MUST NEVER be interpreted as deletion of all remote notes. A client
  treats "I cannot see the remote" as *no information*, not as *empty*.
- A note with a tombstone is not resurrected by a stale offline device unless the
  user explicitly chooses to restore it (which creates a new `upsert` with a
  fresh revision as a child of the tombstone).

## 7. Compatibility and versioning

- Every record and every manifest carries `format_version`.
- A client MUST refuse to read or write a vault whose `format_version` it does not
  recognize, and MUST NOT attempt to "upgrade" files in place. Upgrades are an
  explicit, separately-versioned migration.
- Fixtures in `sync/fixtures/` are the compatibility contract; any client must
  produce byte-identical `rev_id`s and identical index rebuilds from them.

## 8. Assets

- Asset files live in `.images/` and `.audio/` under the sync root and are
  referenced from notes by portable `/.images/...` / `/.audio/...` paths.
- Assets are content-addressed for transfer (dedupe/resume), but their portable
  location is the `.images/` / `.audio/` file, not a blob-only store.
- Asset conflicts and interrupted transfers follow the same rules as notes:
  preserve both sides, retry idempotently, never treat a missing partial transfer
  as deletion.

## 9. Providers

The wire format is identical across providers; only the transport differs. A
vault has **one active provider** at a time. Switching providers is an explicit
migration/copy process, never several sync loops fighting over one vault.

- **Syncthing** — the "provider" is the shared folder itself (the sync root).
- **Nextcloud** — the sync root is a dedicated `PaperCache` folder accessed over
  HTTPS WebDAV; conditional writes use ETags.
- **Google Drive** — the sync root is a visible `PaperCache` folder; minimal
  `drive.file` scope.

## 10. Invariants (tested)

1. `rev_id` is deterministic and content-addressed.
2. Replaying the same record twice is a no-op (idempotency).
3. The index can be rebuilt from records alone and matches the live index.
4. A rename preserves `note_id` and updates only the path.
5. A delete is a durable tombstone and is not undone by a stale offline replay.
6. Concurrent edits fork; both sides are preserved as conflict copies.
7. `mtime`/`created_at` are never used to pick a winner.
