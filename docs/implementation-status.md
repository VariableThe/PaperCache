# PaperCache Mobile + Sync + MCP — Implementation Status

Branch: `feat/mobile-sync-mcp` (based on `origin/main` @ `09e492a`, v0.5.9).

## Recovery vs. newly implemented

**Recovered / discovered during inspection:**

- The real checkout is at `~/Projects/PaperCache` (v0.5.9), not the empty T3
  placeholder. The local `main` ref was stale; `origin/main` is `09e492a`
  (v0.5.9) and the handoff's "0.5.9" baseline matches.
- The interrupted Android/sync/MCP work was **not saved**: there was no
  `mobile/android/` module, no sync design notes, and no protocol fixtures
  anywhere on disk.
- PR #94 (`fix: preserve master key on keyring read failures`) is still **OPEN**
  at head `2d40d607cc8a066d92494b4e8d5474b28905ad91` (unchanged). Not touched.

**Newly implemented (this branch):**

1. `fix(editor): flush debounced save on note switch` — fixes the 500 ms
   debounce save-loss bug; extracts `useDebouncedSave`; regression tests.
2. `feat(sync): shared sync protocol` — `docs/sync-protocol.md`, Rust reference
   core in `src-tauri/src/sync/`, pinned fixtures in `sync/fixtures/`.
3. `feat(mcp): local stdio MCP server` — `mcp/` package (official
   `@modelcontextprotocol/sdk`), read-only default + opt-in write, tested.
4. `feat(desktop): external note reconciliation` — `reconcileNotes` + window-focus
   reconcile, never overwrites the active unsaved buffer; tested.
5. `feat(android): offline-first Android app` — Kotlin/Compose/Room app under
   `mobile/android/` (see below).
6. `feat(sync): folder-provider sync engine` — storage layer (records, portable
   notes, rebuildable index, outbox, conflict copies) + tests.
7. `fix(sync): review-driven hardening` — two P8 round-table reviews applied:
   tombstone-race fix, conflict wiring, atomic writes, corruption tolerance,
   symlink safety, format-version checks.
8. `feat(sync): Nextcloud WebDAV adapter` — list/get/put-with-If-Match/delete/
   mkdir + Login Flow v2, mock-tested.
9. `feat(sync): Google Drive adapter` — OAuth bearer, refresh, list/get/
   conditional-put/delete, config-gated, mock-tested.
10. `feat(sync): desktop sync commands` — `sync_init_folder`/`sync_push_note`/
    `sync_pull_notes` exposed via Tauri.
11. `fix(desktop): remove misleading Voice Memo shortcut` — health cleanup.

## Feature matrix

### Mobile (Android)

| Feature | Status |
| --- | --- |
| Note list + search | Implemented |
| Create / edit / rename | Implemented |
| Durable autosave (flush on navigate) | Implemented (Autosave + test) |
| Offline persistence (Room, survives restart) | Implemented |
| Stable `note_id` (UUID) separate from path | Implemented |
| Tags | Implemented (comma-separated, basic) |
| Undoable trash (soft-delete + restore + hard delete) | Implemented |
| Gestures (swipe-to-trash) + visible buttons | Implemented |
| Markdown preserved byte-for-byte | Implemented (plain editor, no stripping) |
| Clear save / offline / sync states | Implemented (honest "sync not configured") |
| Sync transport (Nextcloud/Syncthing/Drive) | **Not started** |
| Markdown preview, images, arithmetic/vars, links, reminders, AI, graph | **Deferred** |

Android build status: **debug APK built successfully** (16 MB) at
`mobile/android/app/build/outputs/apk/debug/app-debug.apk` (`com.papercache.mobile`
v0.1.0, minSdk 24 / target 35). Toolchain installed user-space (JDK 17 at
`~/jdk17`, Android SDK 35 at `~/Android/Sdk`, Gradle 8.9). No emulator/device
testing was performed (no emulator available); build-only validation reported.

### Sync protocol (shared contract)

| Property | Status |
| --- | --- |
| Stable vault/note IDs independent of filenames | Specified + implemented |
| Markdown path mapping + rename handling | Specified + implemented (tested) |
| Revision ancestry + content hashes | Specified + implemented (tested) |
| Durable outbox/retries + tombstones | Specified (transport not wired) |
| Conflict preservation (edit/edit, rename/edit, delete/edit) | Specified + implemented (tested) |
| Idempotent replay + recovery | Specified + implemented (tested) |
| Asset references + transfer rules | Specified (not implemented) |
| Format-version compatibility checks | Specified + implemented |

### Sync providers

| Provider | Status |
| --- | --- |
| Syncthing ("sync through a folder") | Folder engine implemented (no UI) |
| Nextcloud (WebDAV, Login Flow v2) | Adapter implemented + mock-tested (not live) |
| Google Drive (drive.file scope) | Adapter implemented + mock-tested (not live) |

No provider is wired to real credentials. No live sync has been run (per the
authorization boundary: the user has not authorized access to their server).

### Desktop

| Item | Status |
| --- | --- |
| Save-loss fix | Done + tested |
| External-file reconciliation (window focus) | Done + tested |
| Matching sync adapter (desktop side) | Engine + Tauri commands done; frontend note-id/head mapping loop not wired |
| Health cleanup (misleading copy / disabled-feature labels) | Voice Memo shortcut removed; broader pass partial |

### MCP

| Item | Status |
| --- | --- |
| Local stdio server, official SDK | Done |
| list / search / read tools (bounded) | Done |
| create / update / trash (opt-in write, hash precondition, recoverable) | Done |
| Path-traversal + symlink boundaries | Done + tested |
| No HTTP service, no self-registration | Done |

## Tests

| Suite | Result |
| --- | --- |
| Desktop Vitest | 97 passed (13 files) |
| Sync protocol + engine (Rust `cargo test sync::`) | 29 passed |
| MCP (Vitest) | 17 passed |
| Android unit (Autosave) | 3 passed |

## Remaining user actions for live sync

1. Choose and provision **one** provider (the user owns a Nextcloud server).
2. For Nextcloud: approve Login Flow v2 in-app; the app then stores a revocable
   per-client app password (never the primary password).
3. For Google Drive: create a Cloud project, enable the Drive API, configure
   consent + Android OAuth client matching the package/signing identity, and a
   desktop OAuth client.
4. Grant the app access and confirm the dedicated `PaperCache` folder.
