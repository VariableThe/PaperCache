# PaperCache Sync Compatibility Fixtures

These files are the cross-implementation compatibility contract for the sync
protocol (see `docs/sync-protocol.md`). Any client (desktop Rust, Android Kotlin,
or future) MUST produce byte-identical `rev_id` values and an identical rebuilt
`index.json` from these inputs.

## Contents

- `vault.json` — the vault manifest (format version 1).
- `notes/hello.md` — the note body. Its SHA-256 is the `content_hash` referenced
  by the upsert records.
- `records/*.json` — immutable revision records, named by their `rev_id`.
  The filename MUST equal `sha256(canonical_json(record))`.
- `index.json` — the expected index after replaying all records (idempotent,
  order-independent). The deterministic head for a forked note is the branch
  with the smallest `rev_id`.

## Canonical serialization

`rev_id = sha256(utf8(serde_json::to_string(record)))` with the record field
order fixed as:

```
format_version, note_id, parent_rev, op, path, old_path, content_hash,
content_length, device_id, created_at
```

Optional fields serialize as JSON `null`, never omitted. `op` is lowercase
(`upsert`, `rename`, `delete`). No map-key reordering is involved (all fields
are fixed struct fields).

## Scenario represented

Device A creates `hello.md`, then renames it to `renamed.md`. Device B
concurrently edits `hello.md` on the same base (a fork). Expected result:

- The rename branch wins as head (its `rev_id` is lexicographically smaller).
- Device B's edit is preserved as a conflict copy, not silently dropped.

## Pinned values

| item        | value                                                              |
| ----------- | ------------------------------------------------------------------ |
| content SHA-256 | `2759f0691bc5a2f46d51a6094a21bafe0cd8455a5b000e8238978fc4c6321dda` |
| upsert rev_id | `ed12bc3626fed6539d4e1d2403fe20faed401b87761ebd127b14e874566cd398` |
| rename rev_id | `aba7d15bb01a3671a017de1a5300c9bc8d83c98a60ee1062d4095e1b7db445ea` |
| concurrent edit rev_id | `fe461c84324f8f5467f9c60201126fc4895e45e8a6672c1831d3ba7a6c85d0a1` |
