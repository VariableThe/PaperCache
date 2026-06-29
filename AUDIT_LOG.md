# Project Audit Log

This log tracks all significant changes, updates, and versions in the PaperCache project.

## 2026-06-29 (Code Quality Refactor & Test Suite)
**Change:** refactor(shortcuts): extract helper to deduplicate global shortcut trigger logic; fix(timers): manage completion timeout lifecycle in store; test(editor): add comprehensive unit test suite for `VariableScope`

**Details/Why:**
1. **Shortcut Deduplication**: Extracted `handle_shortcut_trigger` helper in `src-tauri/src/commands/shortcuts.rs` to replace 16 lines of identical duplicate code across `update_global_shortcut` and `resume_shortcuts`.
2. **Managed Timeout Lifecycle**: Replaced unmanaged 5-second `setTimeout` in `useTimerStore.ts` with a tracked Map of active timeouts aligned to `COMPLETED_TIMER_CLEANUP_MS` (10s), ensuring timers cleaned up early or removed explicitly do not trigger orphan state updates.
3. **VariableScope Unit Tests**: Created `src/lib/editor/VariableScope.test.ts` testing global/note scope merging and debounced regex mathematical expression parsing (`/var x = ...`) using fake timers.

**Files changed:** `src-tauri/src/commands/shortcuts.rs`, `src/store/useTimerStore.ts`, `src/lib/editor/VariableScope.test.ts`, `AUDIT_LOG.md`, `CHANGELOG.md`.

---

## 2026-06-29 (Code Quality Cleanup)
**Change:** refactor: code quality cleanup — dead code, boilerplate, types, constants, AI comments; fix: address PR review findings — listener leak, type contracts, dead ref, stale guard, cfg scope, shortcut loop, timer constant

**Details/Why:**
1. **Dead Code Removal**: Removed `resumeTimer` no-op stub from useTimerStore; removed `onSwipeGesture` (ignored callback) from api.ts and types; removed `themePreset`/`setThemePreset` from useAppStore (duplicated in useSettingsStore, all consumers used the latter); removed `prevNotesRef` from useReminders (assigned but never read).
2. **Boilerplate Consolidation**: `useAppStore.ts` — consolidated 9 setters into `booleanSetter`/`simpleSetter` helpers; `api.ts` — extracted 5×8-line identical listener patterns into shared `onEvent` helper; `KeybindsModal.tsx` — replaced 9 parallel `useState`/`getShortcut` calls with data-driven config array; `useSettingsStore.ts` — removed 11 redundant individual setters (use `setSettings` instead).
3. **Rust Fixes**: Fixed clippy `needless_borrows_for_generic_args` in `notifications.rs`; added doc-commented `[lints.rust] unexpected_cfgs = "allow"` for objc crate macro warnings.
4. **Type Safety**: `any` → typed `GraphControls` interface in GraphView; `Promise<unknown>` → properly typed `openAIChat` response; replaced unsafe `as` casts with wrapper functions; `pauseShortcuts`/`resumeShortcuts` changed to return `Promise<void>`.
5. **Magic Numbers → Named Constants**: Extracted ~25 magic numbers across the codebase (z-indices, timeouts, force params, debounce intervals, canvas dimensions, etc.).
6. **Comment Cleanup**: Removed ~15 pedagogical/AI-generated comments.
7. **PR Review Fixes**: Fixed `onEvent` listener leak (added `disposed` flag); fixed stale-token guard in `useReminders` to gate before backend call; fixed `openAIChat` response validation for missing content; removed dead `searchInputRef`/`useEffect` in App.tsx; narrowed `unexpected_cfgs` suppression; made KeybindsModal global shortcut loop data-driven via config; aligned initial timer tick constant in TimersPage.

**Files changed:** `src/store/useTimerStore.ts`, `src/api.ts`, `src/types.d.ts`, `src/setupTests.ts`, `src/store/useAppStore.ts`, `src/store/useAppStore.test.ts`, `src/store/useSettingsStore.ts`, `src/hooks/useReminders.ts`, `src/components/KeybindsModal.tsx`, `src/components/TimersPage.tsx`, `src/GraphView.tsx`, `src/App.tsx`, `src/lib/editor/extensions.ts`, `src/lib/editor/MathEvaluator.ts`, `src/lib/editor/VariableScope.ts`, `src/components/Editor.tsx`, `src-tauri/src/commands/notifications.rs`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/macos.rs`, `CHANGELOG.md`, `AUDIT_LOG.md`.

---

## 2026-06-28 (v0.5.6 Release: Keybinds Modal, Shortcut Mappings, Timer Auto-Delete, and Graph Link Refinement)
**Change:** chore(release): bump version to 0.5.6; feat(shortcuts): add dedicated keybinds settings modal and update global hotkeys (`Cmd+R` for tasks, `Cmd+T` for timers); feat(timers): auto-delete expired timers after 5 seconds; feat(graph): support standard markdown links and wikilinks

**Details/Why:**
1. **Version Bump**: Bumped application version to 0.5.6 across `package.json`, `Cargo.toml`, `tauri.conf.json`, and added release notes file `New Features in v0.5.6.md`.
2. **Keybinds Settings Panel**: Created `ShortcutInput.tsx` as a shared component and `KeybindsModal.tsx` as a dedicated settings panel for remapping shortcuts, accessible via Settings. Added new storage keys in `settingsKeys.ts` and updated `useGlobalHotkey.ts` to dynamically match keyboard events against customizable shortcut settings. Refined UI layout so keycaps are centered horizontally and the container/buttons match the main Settings window.
3. **Keybind Updates**: Updated default shortcuts so `Cmd+R` opens Tasks/Reminders and `Cmd+T` opens the countdown Timers panel, aligning with user navigation habits. Preserved cleared shortcuts via `getShortcut` helper distinguishing `null` from `''`. Dynamically generated the shortcuts reference note (`Cmd+/`) and added recording guards in `useGlobalHotkey.ts` and `ShortcutInput.tsx`. Persisted toggle shortcut changes in `Settings.tsx`.
4. **Timer Auto-Deletion**: Updated `useTimerStore.ts` and `App.tsx` so that when a countdown timer completes, it schedules a targeted 5-second `setTimeout` to call `removeTimer(id)`, reducing UI clutter. Moved backend `timer-complete` event listener to `App.tsx` with robust late-resolution cleanup tracking so completion notifications and auto-cleanup function globally even when the panel is closed or unmounted.
5. **Graph View Link Parsing**: Expanded regex detection in `GraphView.tsx` to link notes using standard markdown links (`[Title](Title.md)`) and wikilinks (`[[Title]]`, stripping aliases like `[[Title|Display]]`) in addition to `/file` links, and removed unused `cz` centroid force values to keep layout logic consistent.

**Files changed:** `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `notes/New Features in v0.5.6.md`, `src/lib/settingsKeys.ts`, `src/components/ShortcutInput.tsx`, `src/components/KeybindsModal.tsx`, `src/store/useAppStore.ts`, `src/App.tsx`, `src/Settings.tsx`, `src/hooks/useGlobalHotkey.ts`, `src/store/useTimerStore.ts`, `src/components/TimersPage.tsx`, `src/GraphView.tsx`, `CHANGELOG.md`, `AUDIT_LOG.md`.

---

## 2026-06-27 (API Key Persistence & Graph View Fixes)
**Change:** fix(ai): fix API key saving/clearing logic and macOS keychain credential updating; fix(graph): prevent `fg.graphData` crashes when opening or closing Graph View

**Details/Why:**
1. **API Key Persistence**: When opening Settings, `apiKey` state initialized to empty string `''`. Clicking "Save Settings" after changing other preferences unintentionally took the `else` branch (`await window.electronAPI.setApiKey('')`), erasing existing keys from the OS keyring. Updated `saveSettings` to only save when `apiKey.trim()` is non-empty, and only clear when `!isApiKeySet`. Added an explicit "Clear Key" UI button next to the password input field when an API key is set.
2. **Keyring Credential Updating**: In `src-tauri/src/commands/keychain.rs`, calling `set_password` on an existing keychain entry could fail on macOS. Updated `set_api_key` to delete any existing credential before setting the new password.
3. **Graph View Crash Fixes**: Merged comprehensive defensive checks (`typeof fg.method === 'function'`) and ref caching into `GraphView.tsx` to prevent `fg.graphData is not a function` crashes when unmounting or toggling Graph View via `Cmd+G`.

**Files changed:** `src/Settings.tsx`, `src-tauri/src/commands/keychain.rs`, `src/GraphView.tsx`, `CHANGELOG.md`, `AUDIT_LOG.md`.

---

## 2026-06-27 (Graph View Bugfix)
**Change:** fix(graph): prevent `e.graphData is not a function` crash on unmount and replace setInterval

**Details/Why:**
1. When navigating to a note from Graph View (`onNodeClick`), the unmounting sequence destroyed internal `react-force-graph-3d` methods on `fgRef.current` before `GraphView`'s effect cleanup ran. Calling `fg.graphData()` threw a TypeError (`e.graphData is not a function`). Added defensive `typeof fg.graphData === 'function'` verification before invocation and introduced `graphDataRef` as a safe fallback cache for node positions.
2. Replaced the active `setInterval` loop in `GraphView.tsx` with a chained `setTimeout` pattern to comply with project timer guidelines (`No setInterval in renderer or main process`).

**Files changed:** `src/GraphView.tsx`, `CHANGELOG.md`, `AUDIT_LOG.md`.

---

## 2026-06-27 (v0.5.5 Release & Smart Onboarding)
**Change:** chore(release): bump version to 0.5.5; implement smart onboarding and release notes routing

**Details/Why:**
1. Bumped application version from 0.5.3 to 0.5.5 across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Implemented smart onboarding routing: detected brand new installations vs existing user upgrades in `run_onboarding` (`fs.rs`). For new installs, release notes (`New Features in v0.5.5.md`) are suppressed and cleaned up so users open directly into a clean `Welcome.md`. For upgrading users, the release note is copied and opened automatically on startup via `checkVersion` (`App.tsx`).
3. Consolidated settings UI by removing duplicate "Check for updates" option from System settings, keeping it inside the new About menu.
4. Added "Submit a Bug Report" button and About section (logo, Ko-fi link, version display).
5. Fixed Windows path normalization for note IDs and internal links.

**Files changed:** `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/App.tsx`, `src/Settings.tsx`, `src/setupTests.ts`, `src-tauri/src/commands/fs.rs`, `src/hooks/useNoteStorage.ts`, `src/lib/editor/markdownPlugin.ts`, `src/GraphView.tsx`, `CHANGELOG.md`, `AUDIT_LOG.md`.

---

## 2026-06-27 (Lockfile Sync)
**Change:** build(deps): move @emnapi WASM fallbacks to devDependencies for deterministic lockfile resolution across OS targets

**Details/Why:**
When `@emnapi/core` and `@emnapi/runtime` were listed under `optionalDependencies` in `package.json`, running `npm install` on macOS arm64 stripped their resolution metadata from `package-lock.json` (since npm deemed WASM fallback bindings inapplicable to macOS native architecture). However, sub-dependencies like `@rolldown/binding-wasm32-wasi` still referenced them, causing `npm ci` on Linux and Windows runners to crash with `Missing: @emnapi/core@1.11.1 from lock file`. Moved `@emnapi/core` and `@emnapi/runtime` to `devDependencies` to guarantee their resolution entries are preserved in `package-lock.json` across all OS targets.

**Files changed:** `package.json`, `package-lock.json`, `AUDIT_LOG.md`.

---

## 2026-06-27 (Update)
**Change:** fix: resolve TypeScript strict build errors in GraphView and setupTests

**Details/Why:**
Resolved production build (`npm run tauri build` / `tsc -b`) failures caused by strict typing mismatches:
1. **`ForceGraphMethods` Typing (`GraphView.tsx`)** — Configured `ForceGraphInstance` to extend `ForceGraphMethods` imported from `react-force-graph-3d`, enabling type-safe calls to `d3Force`, `strength`, `d3ReheatSimulation`, and `cameraPosition`.
2. **Ref Variance (`GraphView.tsx`)** — Casted `<ForceGraph3D>` ref prop to resolve strict `MutableRefObject` variance mismatch.
3. **Mock Contract (`setupTests.ts`)** — Added missing `onUpdateReady` mock implementation to `window.electronAPI` in unit test environment setup.

**Files changed:** `src/GraphView.tsx`, `src/setupTests.ts`, `AUDIT_LOG.md`, `CHANGELOG.md`.

---

## 2026-06-27
**Change:** fix: address audit findings — ESC logic, IPC types, update UX, mutex safety, ESLint (PR #68)

**Details/Why:**
Full-pass code-quality audit surfaced several correctness bugs and robustness issues that were fixed in a single PR:

1. **ESC key logic** (`useGlobalHotkey.ts`) — The window was being hidden before checking whether any overlay (graph, timer panel, reminders) was open. Restructured to dismiss overlays in priority order; window hides only as final fallback.
2. **IPC `void` types** (`types.d.ts`, `api.ts`) — `openExternal`, `openFile`, `setLaunchAtStartup`, `quitApp` were declared as returning `void` but the underlying `invoke()` is async. Changed to `Promise<void>`; `setLaunchAtStartup` now returns its promise instead of fire-and-forget.
3. **Silent auto-restart** (`system.rs`) — App was calling `app.restart()` immediately after an update download with no user notice. Now runs download in a background Tokio task, emits `update-ready` to the frontend (which shows a toast), waits 3 seconds, then restarts.
4. **Mutex `unwrap()` panics** (`shortcuts.rs`) — Two `.unwrap()` calls on `Mutex::lock()` replaced with `.map_err(|e| e.to_string())?` for graceful error propagation.
5. **Dead-end Pause button** (`TimersPage.tsx`) — Removed the ⏸ button since `resumeTimer` is an unimplemented stub; a button with no un-pause path was worse UX than no button.
6. **macOS `AppHandle` memory leak** (`macos.rs`) — Added a `SAFETY` comment documenting why `Box::into_raw` is intentionally not paired with `Box::from_raw`.
7. **ESLint warnings** (`GraphView.tsx`) — Introduced a `ForceGraphInstance` interface replacing the `any` ref type; snapshotted `fgRef.current` inside effect body to fix stale-ref cleanup warning.
8. **`react`/`react-dom` dependency category** (`package.json`) — Moved from `devDependencies` to `dependencies`.

**Files changed:** `src/hooks/useGlobalHotkey.ts`, `src/types.d.ts`, `src/api.ts`, `src/App.tsx`, `src-tauri/src/commands/system.rs`, `src-tauri/src/commands/shortcuts.rs`, `src-tauri/src/macos.rs`, `src/components/TimersPage.tsx`, `src/GraphView.tsx`, `package.json`, `CHANGELOG.md`.

---

## 2026-06-25
**Change:** fix: switch autostart from LaunchAgent to LoginItem (AppleScript)

**Details/Why:**
The app was registered via `MacosLauncher::LaunchAgent`, creating a hidden `.plist` in `~/Library/LaunchAgents/` invisible to the user. Changed to `MacosLauncher::AppleScript`, which uses AppleScript to register via System Events — the app now appears in System Settings > General > Login Items as a user-manageable entry. The `--silently` flag and `hide_dock_icon()` still work as before.

**Files changed:** `src-tauri/src/lib.rs`, `CHANGELOG.md`.

---

### 2026-06-25 - fix: remove macOS frameless window 28px shift compensation (PR #62)

**Details/Why:**
The v0.5.4 window-state fix incorrectly added +/-28px compensation for a supposed macOS frameless window titlebar offset in `tauri-plugin-window-state`. Tracing through the full stack (`tauri-plugin-window-state` v2.4.1 → `tauri-runtime-wry` → `tao` 0.35.3) confirmed no such offset exists for `decorations: false` windows — `outer_position()` returns the window frame origin and `set_position()` sets it correctly. Removed all compensation from save and restore paths.

**Files changed:** `src-tauri/src/commands/system.rs`, `src-tauri/src/lib.rs`, `CHANGELOG.md`.

---

### 2026-06-25 - fix: shortcut key pill "+" centered between key caps

**Details/Why:**
In the Settings global shortcuts section, the `renderShortcutDisplay` function grouped each key cap and the `+` to its right in a wrapper `<span>`, with the outer container using `justify-content: space-evenly`. This made the `+` appear closer to the left key cap. Fixed by flattening to `<Fragment>` siblings in a flex row with `justify-content: center` and `gap: 4px`.

**Files changed:** `src/Settings.tsx`, `CHANGELOG.md`.

---

### 2026-06-25 - fix: hide scrollbars on Windows/Linux in Settings and editor

**Details/Why:**
`.settings-content` and `.editor-container` used `overflow-y: auto`/`overflow: auto` without scrollbar-hiding rules. macOS overlay scrollbars auto-hide, but Windows/Linux show persistent scrollbars. Added `scrollbar-width: none` (Firefox), `-ms-overflow-style: none` (IE/Edge), and `::-webkit-scrollbar { display: none }` (Chrome/Edge/Safari) to both containers.

**Files changed:** `src/Settings.css`, `src/App.css`, `CHANGELOG.md`.

---

### 2026-06-25 - fix: window state persistence and login-item toggle desync (v0.5.4)

**Details/Why:**
Two bug fixes for window state and settings reliability:

1. **Window position/size not persisting across restarts**: The `tauri-plugin-window-state` v2.4.1's `on_window_ready` fires before the macOS display server is ready, causing `available_monitors()` to return empty and the saved position to be silently discarded. Fixed with a two-pronged approach: (a) `lib.rs:107-140` spawns a background thread that sleeps 300ms then dispatches `restore_state` + direct file read via `run_on_main_thread` — ensures display server is ready; (b) `commands/system.rs:33-73` new `restore_window_state` command reads `.window-state.json` directly and calls `set_position`/`set_size`, bypassing the plugin's intersection check as a fallback. Both tray "Quit" and Settings "Quit" now call `app.save_window_state()` explicitly before `app.exit(0)`.

2. **Launch-at-startup toggle desync with macOS System Settings**: The toggle only read from `localStorage`, so removing PaperCache from System Settings left it permanently stuck on. Fixed by adding `get_launch_at_startup` Tauri command (`system.rs:96-98`) that queries `app.autolaunch().is_enabled()`, bridged to frontend via `api.ts`/`types.d.ts`. `Settings.tsx:52-59` runs `getLaunchAtStartup()` on mount to sync toggle and `localStorage` with real OS state.

**Files changed:** `src-tauri/src/commands/system.rs`, `src-tauri/src/tray.rs`, `src-tauri/src/lib.rs`, `src/App.tsx:56`, `src/Settings.tsx:48-61`, `src/Settings.test.tsx`, `src/types.d.ts`, `src/api.ts`, `CHANGELOG.md`.

---

## 2026-06-24 - (Uncommitted)
**Change:** feat: graph view rebuilt, Windows focus-loss fix, Cmd+/ shortcuts, welcome revamp (v0.5.3)

**Details/Why:**
Major graph view overhaul and cross-platform fixes:

1. **Flat Circle Nodes with Occlusion**: Replaced default 3D spheres with `CircleGeometry` meshes. Circles render in the transparent pass at `renderOrder: 1` (after edges), with `depthWrite: true` — edges passing through nodes are now cleanly occluded.

2. **Always-Visible Labels**: Each node returns a `THREE.Group` containing the circle mesh plus a canvas-based `THREE.Sprite` label. Labels are positioned below each circle and always visible (never fade on zoom).

3. **Cmd+F Fuzzy Search in Graph**: Search bar with character-order fuzzy matching, arrow-key navigation, and Enter to fly the camera to the matched node.

4. **Folder Clustering**: `d3-force` `forceX`/`forceY` at 0.008 strength weakly attract same-folder nodes toward shared centroids on a 60-unit radius, creating subtle visual groupings.

5. **Cmd+Shift+N No Longer Hides Open App**: Changed the Rust global shortcut handler in `shortcuts.rs` — for `new-note` action, window only shows if hidden; never hides when already visible. All other shortcuts (toggle, etc.) retain `toggle_window` behavior.

6. **Windows Focus-Loss Debounce**: `lib.rs` focus-loss handler now uses a 200ms debounce via `AtomicBool` + `std::thread::spawn`. Clicking the title bar on Windows 10 briefly triggers `Focused(false)` — the debounce waits 200ms for a matching `Focused(true)` before hiding. On macOS, hide remains immediate.

7. **Cmd+/ Shortcuts Reference**: New shortcut opens or auto-creates `Shortcuts.md` with all keyboard shortcuts and slash commands listed.

8. **Fresh Install Welcome**: Version check in `App.tsx` detects `null` last-seen-version (fresh install) and opens `Welcome.md` instead of looking for a new-features note. The Rust onboarding template (`fs.rs`) was revamped with a bullet-list feature overview.

9. **Lazy-Loaded Graph**: `GraphView` dynamically imported via `React.lazy()` — Three.js bundle (~1.3 MB) loads only on first graph open.

10. **Doc Updates**: Version bumped to 0.5.3 across all manifest files. `CHANGELOG.md`, `features.md`, `README.md`, `notes/New Features in v0.5.3.md` all updated.

---

## 2026-06-24 - Native Notifications, Timers, DSL Engine, WebGL Graph
**Change:** feat: native notifications, timers, DSL regex engine, WebGL graph with folder attraction

**Details/Why:**
Implemented four major platform features as requested:

1. **Native Reminder Notifications (Rust Backend):** Removed the old Web Notification API + `setTimeout` polling loop from the JS renderer. All reminder scheduling is now delegated to a new `commands/notifications.rs` Rust module. Uses `tokio::spawn` + `tokio::time::sleep` to wait for exact due times and fires native OS notifications via `tauri_plugin_notification`. This ensures reminders are reliable when the app is minimized, handles OS notification permission gracefully, and eliminates renderer-side timer drift. A `reminder-fired` Tauri event is emitted to the frontend to show an in-app toast and update localStorage.

2. **Timers:** Added a new `useTimerStore.ts` Zustand store and `TimersPage.tsx` component with a glassmorphic panel UI. Countdowns use a chained `setTimeout` pattern (no `setInterval`) for drift-corrected display. The Rust backend (`schedule_timer` / `cancel_timer` commands) fires the native OS notification and emits `timer-complete` on completion — ensuring timers complete even when minimized. A "Timers" button was added to `MainActionMenu`, and the `/timer` slash command was added to the editor.

3. **DSL Regex Parsing Engine:** Created `src/lib/editor/dslPlugin.ts` — a factory `createRegexPlugin(rules: DSLRule[])` that generates CodeMirror ViewPlugins. Scans only `view.visibleRanges` per update tick (O(visible lines)), guaranteeing lag-free typing at any document size. Supports `className` mark decorations, `widget` factories, and `onMatch` callbacks per rule.

4. **WebGL Graph with Folder Attraction:** Replaced `react-force-graph-2d` (Canvas 2D) with `react-force-graph-3d` (Three.js / WebGL) lazy-loaded via `React.Suspense`. The graph is configured in 2D mode (z-axis locked). Added custom `d3-force` `forceX` and `forceY` forces that pull nodes toward per-folder centroid positions, creating organic cluster layouts where notes from the same folder attract each other.

**Files changed:** `src-tauri/src/commands/notifications.rs` [NEW], `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `package.json`, `src/types.d.ts`, `src/api.ts`, `src/hooks/useReminders.ts`, `src/hooks/useReminders.test.ts`, `src/store/useAppStore.ts`, `src/store/useTimerStore.ts` [NEW], `src/components/TimersPage.tsx` [NEW], `src/components/MainActionMenu.tsx`, `src/lib/editor/slashCommands.ts`, `src/lib/editor/dslPlugin.ts` [NEW], `src/GraphView.tsx`, `src/App.tsx`, `src/App.css`.

---

## 2026-06-24 - (Uncommitted)
**Change:** feat: add slash command autosuggest, auto-open new features note, and tag action menu for v0.5.2

**Details/Why:**
Implemented a ghost-text inline autosuggest widget for slash commands to reduce friction. Added logic to auto-open `New Features in v[version].md` once per update, and automatically cleanup older version notes in the base directory via `fs.rs`. Replaced `/task-done` with `/check` to streamline UX. Added a right-click inline Tag Action Menu to allow bulk deletion and native Tauri-based export of notes containing specific tags. Fixed UI collision issues where the tag menu was inheriting `.note-action-menu` CSS class and spawning off-screen.

---

## 2026-06-23 - (Uncommitted)
**Change:** fix: shift all keybinds to Alt and disable window auto-hide

**Details/Why:**
Changed default keybindings across the application from `Ctrl/Cmd` to `Alt` to prevent conflicts. Disabled auto-hide on focus loss in `lib.rs` to allow the app to be used as a persistent window, fixing Wayland shortcut issues.

---

## 2026-06-23 - a250dce8a
**Change:** feat: enable auto-updates on startup and add manual check button

**Details/Why:**

---

## 2026-06-23 - 1b84df0ff
**Change:** fix: remaining 5 issues from user plan

**Details/Why:**

---

## 2026-06-23 - 5ca20d975
**Change:** style: run prettier on App.css

**Details/Why:**

---

## 2026-06-23 - b38393e16
**Change:** fix: final v0.5.0-beta fixes and pipeline repair

**Details/Why:**

---

## 2026-06-23 - c10990f77
**Change:** Merge pull request #43 from VariableThe/feature/tauri-migration

**Details/Why:**
fix: ignore legacy Electron window-state.json files when loading notes
---

## 2026-06-23 - d88a88329
**Change:** Merge pull request #42 from VariableThe/VariableThe-patch-4

**Details/Why:**
Update README.md
---

## 2026-06-23 - cdaf5c781
**Change:** Update README.md

**Details/Why:**

---

## 2026-06-23 - 4a166b557
**Change:** fix: ignore legacy Electron window-state.json files when loading notes

**Details/Why:**

---

## 2026-06-23 - f89eb6d10
**Change:** Merge pull request #41 from VariableThe/feature/tauri-migration

**Details/Why:**
chore: ignore window-state.json
---

## 2026-06-23 - 5608178b2
**Change:** chore: ignore window-state.json

**Details/Why:**

---

## 2026-06-23 - 666ede05c
**Change:** Merge pull request #40 from VariableThe/feature/tauri-migration

**Details/Why:**
chore: documentation and CI/CD fixes
---

## 2026-06-23 - f8f51faf9
**Change:** ci: fix Homebrew Cask auto-update logic for Tauri artifact names

**Details/Why:**

---

## 2026-06-23 - 2b941c48e
**Change:** docs: remove zoom shortcuts from README

**Details/Why:**

---

## 2026-06-23 - f72b83a8b
**Change:** Merge pull request #39 from VariableThe/feature/tauri-migration

**Details/Why:**
v0.5.0-beta: Tauri Migration
---

## 2026-06-23 - 35be397a1
**Change:** docs: add TAURI_MIGRATION.md

**Details/Why:**

---

## 2026-06-23 - ffc9f57a0
**Change:** v0.5.0-beta: Tauri Migration

**Details/Why:**

---

## 2026-06-23 - be279b7c1
**Change:** fix: shortcut input styling, prevent Escape from closing app, prevent window drift

**Details/Why:**

---

## 2026-06-23 - 666e275e8
**Change:** fix: enable macOSPrivateApi to fix black corners on transparent windows

**Details/Why:**

---

## 2026-06-23 - f30b20ed3
**Change:** fix: remove invalid Objective-C selector call causing panic on launch

**Details/Why:**

---

## 2026-06-23 - 8db08c783
**Change:** fix: resolve window cascading and shadow glitches, update performance audit

**Details/Why:**

---

## 2026-06-23 - 587fd7369
**Change:** Merge pull request #38 from VariableThe/fix/ts-build-errors

**Details/Why:**
fix: remove beta from version to fix Windows MSI bundle error
---

## 2026-06-23 - ecb47f5cd
**Change:** fix: remove beta from version to fix Windows MSI bundle error

**Details/Why:**

---

## 2026-06-23 - 39f484c62
**Change:** Merge pull request #37 from VariableThe/fix/ts-build-errors

**Details/Why:**
fix: resolve TS build errors related to expr-eval and vitest
---

## 2026-06-23 - af869e4b7
**Change:** fix: resolve TS build errors related to expr-eval and vitest

**Details/Why:**

---

## 2026-06-23 - 7e85f4ce3
**Change:** Merge pull request #36 from VariableThe/fix/github-action-tauri

**Details/Why:**
Fix/GitHub action tauri
---

## 2026-06-23 - abeb0577f
**Change:** fix: add tauri script for github action

**Details/Why:**

---

## 2026-06-22 - c8218a284
**Change:** fix: resolve eslint and clippy warnings

**Details/Why:**

---

## 2026-06-22 - f1364165e
**Change:** chore: clean up orphaned files and co-locate tests

**Details/Why:**

---

## 2026-06-22 - 09ad105b5
**Change:** docs: fix stale Electron references in features.md and CONTRIBUTING.md

**Details/Why:**

---

## 2026-06-22 - a5922693c
**Change:** Merge pull request #35 from VariableThe/chore/tauri-docs-v0.5.0

**Details/Why:**
v0.5.0-beta: Tauri Migration
---

## 2026-06-22 - de4350a24
**Change:** fix: regenerate package-lock.json from scratch for CI sync

**Details/Why:**

---

## 2026-06-22 - 5397fb511
**Change:** fix: sync package-lock.json for CI

**Details/Why:**

---

## 2026-06-22 - 16f4b76ba
**Change:** v0.5.0-beta: Tauri Migration

**Details/Why:**

---

## 2026-06-22 - b9755fd9f
**Change:** Merge pull request #34 from VariableThe/fix/package-lock-sync

**Details/Why:**
fix: synchronize package-lock for cross-platform builds
---

## 2026-06-22 - 821b3e2ed
**Change:** fix: synchronize package-lock for cross-platform builds

**Details/Why:**

---

## 2026-06-22 - 3e506c424
**Change:** Merge pull request #33 from VariableThe/chore/clean-dependencies

**Details/Why:**
chore: clean up orphaned and unused dev dependencies
---

## 2026-06-22 - 2c767c3c2
**Change:** chore: clean up orphaned and unused dev dependencies

**Details/Why:**

---

## 2026-06-22 - c0977f663
**Change:** Merge pull request #32 from VariableThe/docs-gatekeeper-warning

**Details/Why:**
Docs: Improve macOS Gatekeeper warning
---

## 2026-06-22 - 333f8f2ed
**Change:** docs: improve macos gatekeeper warning

**Details/Why:**

---

## 2026-06-22 - 93be431df
**Change:** Merge pull request #31 from VariableThe/update-screenshots

**Details/Why:**
Docs: Update README with new feature showcase screenshots
---

## 2026-06-22 - e0673321f
**Change:** docs: update readme with new feature showcase screenshots

**Details/Why:**

---

## 2026-06-22 - b381cdb5d
**Change:** Merge pull request #30 from VariableThe/fix-onboarding-update

**Details/Why:**
Fix: Force-update onboarding docs for existing users
---

## 2026-06-22 - 32a2a8734
**Change:** fix: forcefully update markdown onboarding for existing users

**Details/Why:**

---

## 2026-06-22 - 6dfaeaece
**Change:** Merge pull request #29 from VariableThe/chore-update-philosophy

**Details/Why:**
Docs: Ground the core philosophy and add Antinote origin story
---

## 2026-06-22 - 5f66af8d2
**Change:** docs: ground philosophy and add antinote origin story

**Details/Why:**

---

## 2026-06-22 - 5260e4630
**Change:** Merge pull request #28 from VariableThe/fix-onboarding-openrouter

**Details/Why:**
Docs: Add OpenRouter API key link to onboarding
---

## 2026-06-22 - fdaddb5c2
**Change:** docs: add openrouter api key link to onboarding

**Details/Why:**

---

## 2026-06-22 - 078b47c26
**Change:** Merge pull request #27 from VariableThe/VariableThe-patch-3

**Details/Why:**
Update PERFORMANCE_AUDIT.md
---

## 2026-06-22 - e4395c76b
**Change:** Update PERFORMANCE_AUDIT.md

**Details/Why:**

---

## 2026-06-22 - eca60354f
**Change:** Merge pull request #26 from VariableThe/VariableThe-patch-2

**Details/Why:**
Update OS version in performance audit documentation
---

## 2026-06-22 - 21228254f
**Change:** Update OS version in performance audit documentation

**Details/Why:**

---

## 2026-06-22 - fc3f0456b
**Change:** Merge pull request #25 from VariableThe/VariableThe-patch-1

**Details/Why:**
Update PERFORMANCE_AUDIT.md
---

## 2026-06-22 - 01e468fc6
**Change:** Update PERFORMANCE_AUDIT.md

**Details/Why:**

---

## 2026-06-22 - 235790b27
**Change:** Merge pull request #24 from VariableThe/fix-release-sync-step

**Details/Why:**
CI: Remove redundant npm version sync step
---

## 2026-06-22 - 6b4a79e6e
**Change:** ci: remove unnecessary npm version sync step

**Details/Why:**

---

## 2026-06-22 - 8da45c35a
**Change:** Merge pull request #23 from VariableThe/fix-release-workflow

**Details/Why:**
CI: Strictly sync release tags with package.json
---

## 2026-06-22 - 87184535f
**Change:** ci: read release version strictly from package.json

**Details/Why:**

---

## 2026-06-22 - 716e5ae44
**Change:** Merge pull request #22 from VariableThe/release-0.4.0

**Details/Why:**
Release v0.4.0
---

## 2026-06-22 - 8d5c23bfd
**Change:** chore: regenerate package-lock.json to fix emnapi CI error

**Details/Why:**

---

## 2026-06-22 - b8652d603
**Change:** chore: sync package-lock.json

**Details/Why:**

---

## 2026-06-22 - 036276ec8
**Change:** chore: release v0.4.0 with updated docs and onboarding

**Details/Why:**

---

## 2026-06-22 - 1a4a4ad3c
**Change:** Merge pull request #21 from VariableThe/update-security-md

**Details/Why:**
docs: simplify security policy
---

## 2026-06-22 - 0b7db023a
**Change:** docs: simplify security policy

**Details/Why:**

---

## 2026-06-22 - c576b17ac
**Change:** Merge pull request #20 from VariableThe/add-llms-txt

**Details/Why:**
docs: add llms.txt for AI context
---

## 2026-06-22 - 6e1258bff
**Change:** docs: add llms.txt for AI context

**Details/Why:**

---

## 2026-06-22 - 67bbcd757
**Change:** Merge pull request #19 from VariableThe/feat/shortcut-recorder

**Details/Why:**
feat: UI improvements and recording bug fixes
---

## 2026-06-22 - da51cfe31
**Change:** ci: automate release on push to main

**Details/Why:**

---

## 2026-06-22 - a6ac8a560
**Change:** Merge pull request #18 from VariableThe/feat/shortcut-recorder

**Details/Why:**
feat: interactive shortcut recorder in settings
---

## 2026-06-22 - 6dd614a2c
**Change:** feat: render shortcut keys as squircles and pause global shortcuts while recording

**Details/Why:**

---

## 2026-06-22 - 9211ca184
**Change:** feat: use symbols for shortcut display

**Details/Why:**

---

## 2026-06-22 - fe4be4635
**Change:** feat: replace text inputs with interactive shortcut recorder in settings

**Details/Why:**

---

## 2026-06-22 - ca42baa1f
**Change:** Merge pull request #17 from VariableThe/fix/internal-link-overwrite

**Details/Why:**
fix: prevent linked notes from being overwritten with old state
---

## 2026-06-22 - 2d3e14887
**Change:** fix: completely remount CodeMirror on note change to prevent state overwrites

**Details/Why:**

---

## 2026-06-21 - d808eb150
**Change:** docs: add core philosophy

**Details/Why:**

---

## 2026-06-21 - b1883cc4b
**Change:** Merge pull request #16 from VariableThe/feat/production-hardening

**Details/Why:**
chore: final cleanup and lint fixes
---

## 2026-06-21 - d280c6e06
**Change:** docs: add ko-fi support link

**Details/Why:**

---

## 2026-06-21 - 950ccff30
**Change:** chore: final cleanup and lint fixes

**Details/Why:**

---

## 2026-06-21 - 73535a6c9
**Change:** Merge pull request #15 from VariableThe/feat/production-hardening

**Details/Why:**
feat: Production readiness & security hardening
---

## 2026-06-21 - a2f80e74b
**Change:** fix: support closing Tasks and Graph view with Escape key

**Details/Why:**

---

## 2026-06-21 - 840eec732
**Change:** ui: normalize fonts across the app according to settings and adjust weights

**Details/Why:**

---

## 2026-06-21 - 02b1c6660
**Change:** ui: adjust Graph View font and hide node labels on zoom out

**Details/Why:**

---

## 2026-06-21 - 2e7655406
**Change:** fix: import autoUpdater as CJS default export

**Details/Why:**

---

## 2026-06-21 - e300f4a93
**Change:** chore: bump version to 0.2.10

**Details/Why:**

---

## 2026-06-21 - 74d96589f
**Change:** 0.1.18

**Details/Why:**

---

## 2026-06-21 - 20cf69f10
**Change:** chore: address PR review feedback and fix dev build

**Details/Why:**

---

## 2026-06-21 - e28566e9c
**Change:** fix: apply CodeRabbit auto-fixes

**Details/Why:**
Fixed 5 file(s) based on 7 unresolved review comments.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>
---

## 2026-06-21 - 1e7f47682
**Change:** chore: Sync package-lock.json

**Details/Why:**

---

## 2026-06-21 - cf9770dda
**Change:** feat: Production readiness & security hardening

**Details/Why:**

---

## 2026-06-21 - ecdf6781d
**Change:** Merge pull request #14 from VariableThe/docs/update-demo-images

**Details/Why:**
docs: update README with new demo images
---

## 2026-06-21 - 75d828c6e
**Change:** docs: update README with new demo images

**Details/Why:**

---

## 2026-06-21 - 45f617909
**Change:** Merge pull request #13 from VariableThe/fix-agent-rule-violations

**Details/Why:**
Fix agent rule violations
---

## 2026-06-21 - 8c43d0303
**Change:** fix: resolve tasks toggle listener leak and rename menu button

**Details/Why:**

---

## 2026-06-20 - 375b5a7ed
**Change:** fix: apply CodeRabbit auto-fixes

**Details/Why:**
Fixed 3 file(s) based on 2 unresolved review comments.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>
---

## 2026-06-21 - 8d028e67e
**Change:** Merge pull request #12 from VariableThe/fix-agent-rule-violations

**Details/Why:**
fix: resolve architecture rule violations from AGENTS.md
---

## 2026-06-21 - 369b454ed
**Change:** fix: resolve architecture rule violations from AGENTS.md

**Details/Why:**

---

## 2026-06-20 - f2aed06f6
**Change:** Merge pull request #11 from VariableThe/feature/component-refactor-and-math-fixes

**Details/Why:**
CI/CD Pipeline Refactoring and Test Type Fixes
---

## 2026-06-20 - b04e33035
**Change:** Refactor release.yml to use matrix strategy, sync version, and auto-update homebrew tap

**Details/Why:**

---

## 2026-06-20 - a8d4f0f5a
**Change:** Merge pull request #10 from VariableThe/feature/component-refactor-and-math-fixes

**Details/Why:**
Refactor App.tsx, fix MathEvaluator, and optimize bundles
---

## 2026-06-20 - 0e655854c
**Change:** Fix mock view annotations in widgets.test.ts

**Details/Why:**

---

## 2026-06-20 - 91e2eb1b8
**Change:** Fix inline bugs and verify math evaluator stability

**Details/Why:**

---

## 2026-06-20 - 408790d6f
**Change:** Refactor App components, fix math logic, and fix build typescript errors

**Details/Why:**

---

## 2026-06-20 - 1c30cf59a
**Change:** Update LICENSE

**Details/Why:**

---

## 2026-06-20 - ef84064e7
**Change:** Merge pull request #9 from VariableThe/perf-optimizations

**Details/Why:**
perf: optimize mathjs lazy loading and debouncing
---

## 2026-06-20 - 9aee209e3
**Change:** fix: resolve TS catch clause type and useVariables race condition

**Details/Why:**

---

## 2026-06-20 - b4b60d4dd
**Change:** perf: optimize mathjs lazy loading and debouncing

**Details/Why:**

---

## 2026-06-20 - ebb422316
**Change:** docs: add comprehensive project rules for agents

**Details/Why:**

---

## 2026-06-20 - 99a0aad69
**Change:** chore: add agent rules to prevent direct pushes to main

**Details/Why:**

---

## 2026-06-20 - 6e5fb4cf0
**Change:** feat: interactive hex color pills and DD-MM-YYYY date support

**Details/Why:**

---

## 2026-06-20 - d6d58ca2b
**Change:** style: change default number highlighting color to pastel blue

**Details/Why:**

---

## 2026-06-20 - f33d06863
**Change:** fix: memory leak in power IPC listeners

**Details/Why:**

---

## 2026-06-20 - 6b6d2d1aa
**Change:** docs: link performance audit in README

**Details/Why:**

---

## 2026-06-20 - f801f04ae
**Change:** Update performance audit status

**Details/Why:**

---

## 2026-06-20 - 3a329cadb
**Change:** Fix performance and battery issues

**Details/Why:**

---

## 2026-06-20 - 4cecf985d
**Change:** Merge branch 'fix/settings-tests'

**Details/Why:**

---

## 2026-06-20 - 21d9321ec
**Change:** docs: refresh features list

**Details/Why:**

---

## 2026-06-20 - f64087625
**Change:** Merge pull request #8 from VariableThe/fix/settings-tests

**Details/Why:**
test: fix broken settings tests
---

## 2026-06-20 - 7644dfd24
**Change:** test: fix broken tests after UI and safe storage updates

**Details/Why:**

---

## 2026-06-20 - f51dff1b0
**Change:** Merge pull request #7 from VariableThe/fix/openrouter-defaults-and-settings

**Details/Why:**
fix: updated openrouter defaults and settings window
---

## 2026-06-20 - f4be61061
**Change:** fix: updated openrouter defaults and made settings window track main window bounds

**Details/Why:**

---

## 2026-06-20 - e90bccf1e
**Change:** 0.1.17

**Details/Why:**

---

## 2026-06-20 - 5cbe87b02
**Change:** Add GH_TOKEN to package script

**Details/Why:**

---

## 2026-06-20 - 2121cd375
**Change:** 0.1.16

**Details/Why:**

---

## 2026-06-20 - c73f2eede
**Change:** Fix final two TS errors

**Details/Why:**

---

## 2026-06-20 - 9b085b431
**Change:** 0.1.15

**Details/Why:**

---

## 2026-06-20 - d00d16399
**Change:** Remove exactOptionalPropertyTypes

**Details/Why:**

---

## 2026-06-20 - 1ee93519b
**Change:** 0.1.14

**Details/Why:**

---

## 2026-06-20 - 0c10d9836
**Change:** 0.1.13

**Details/Why:**

---

## 2026-06-20 - 7782afbff
**Change:** Disable strict mode to fix build

**Details/Why:**

---

## 2026-06-20 - 1ba8687a0
**Change:** 0.1.12

**Details/Why:**

---

## 2026-06-20 - 24c247e24
**Change:** Change npm ci to npm install

**Details/Why:**

---

## 2026-06-20 - 21053d058
**Change:** 0.1.11

**Details/Why:**

---

## 2026-06-20 - 290e1a5f6
**Change:** Fix GH Actions node version and runner

**Details/Why:**

---

## 2026-06-20 - e8467aece
**Change:** 0.1.10

**Details/Why:**

---

## 2026-06-20 - 26422cf47
**Change:** Update package-lock

**Details/Why:**

---

## 2026-06-20 - 1b28deff8
**Change:** 0.1.9

**Details/Why:**

---

## 2026-06-20 - 2d46b7513
**Change:** Refactor App.tsx, move to zustand, and update code quality (#6)

**Details/Why:**

---

## 2026-06-20 - 0cd6242dd
**Change:** 0.1.8

**Details/Why:**

---

## 2026-06-20 - 955b8ea1a
**Change:** 0.1.7

**Details/Why:**

---

## 2026-06-20 - 05a2010eb
**Change:** Merge pull request #5 from VariableThe/feature/tasks

**Details/Why:**
feat: Add Tasks feature
---

## 2026-06-20 - e36a94c72
**Change:** feat: Add Tasks feature, onboard docs, and updates

**Details/Why:**

---

## 2026-06-15 - c0d1328e5
**Change:** Merge pull request #4 from VariableThe/feature/currency-and-open-note

**Details/Why:**
feat: persist last open note and add currency pills
---

## 2026-06-15 - 65084de03
**Change:** feat: persist last open note and add currency pills

**Details/Why:**

---

## 2026-06-13 - e0524dff5
**Change:** Merge pull request #3 from VariableThe/feature/checkbox

**Details/Why:**
Feature/checkbox
---

## 2026-06-13 - 20c31c489
**Change:** style: fix prettier formatting issues

**Details/Why:**

---

## 2026-06-13 - 28fe0eb6d
**Change:** fix: add author field for linux deb build

**Details/Why:**

---

## 2026-06-13 - e0f2d4a5c
**Change:** feat: add interactive checkbox feature

**Details/Why:**

---

## 2026-06-08 - 205494cdf
**Change:** Merge pull request #2 from blackfang007/add-windows-ci

**Details/Why:**
Add Windows CI testing
---

## 2026-06-07 - 2439b4490
**Change:** Apply Prettier formatting

**Details/Why:**

---

## 2026-06-07 - 29ab65d25
**Change:** Fix workflow formatting

**Details/Why:**

---

## 2026-06-07 - 17a1f3754
**Change:** Merge pull request #1 from blackfang007/fix-windows-line-endings

**Details/Why:**
Add .gitattributes for consistent line endings across platforms
---

## 2026-06-05 - a5dc15ec7
**Change:** Add Windows CI testing

**Details/Why:**

---

## 2026-06-05 - 6dfaed51e
**Change:** Add .gitattributes for consistent line endings

**Details/Why:**

---

## 2026-06-02 - 58c70415e
**Change:** Add empty line before horizontal rule demo and bump to 0.1.5

**Details/Why:**

---

## 2026-06-02 - 69acb2415
**Change:** Add horizontal rule demo and update copy button text in intro notes

**Details/Why:**

---

## 2026-06-02 - 6262b4f51
**Change:** Fix Prettier errors in CSS

**Details/Why:**

---

## 2026-06-02 - 1bea6a335
**Change:** Fix ESLint and Prettier errors

**Details/Why:**

---

## 2026-06-02 - 80f03f8e2
**Change:** Bump version to 0.1.3

**Details/Why:**

---

## 2026-06-02 - a19d034ef
**Change:** Fix --- rendering and update commands

**Details/Why:**

---

## 2026-06-01 - e7e3f2679
**Change:** feat: shortcuts and hr support

**Details/Why:**

---

## 2026-05-31 - 86f0fd727
**Change:** chore: bump version to v0.1.1

**Details/Why:**

---

## 2026-05-31 - 775dfc378
**Change:** fix: run prettier on markdown files to fix CI

**Details/Why:**

---

## 2026-05-31 - 997d87551
**Change:** fix: use new logo files for menu bar tray icon and clean up old ones

**Details/Why:**

---

## 2026-05-31 - 308669a44
**Change:** docs: rename screenshots, update README layout and add features doc

**Details/Why:**

---

## 2026-05-31 - d84628d6b
**Change:** style: fix prettier formatting errors

**Details/Why:**

---

## 2026-05-31 - e85b37c91
**Change:** chore: resize icon to 512x512 for electron-builder

**Details/Why:**

---

## 2026-05-31 - 4b9813f10
**Change:** 0.1.0

**Details/Why:**

---

## 2026-05-31 - ad9a895db
**Change:** feat: add format and color recognition, tag support, and new logos

**Details/Why:**

---

## 2026-05-31 - bfe6db4cb
**Change:** fix: use npm install instead of npm ci in github actions to avoid cross-platform lockfile mismatches

**Details/Why:**

---

## 2026-05-31 - 8ca13f0c1
**Change:** fix: update Node.js version in CI and sync lockfile

**Details/Why:**

---

## 2026-05-31 - bbc42a3d0
**Change:** fix: vite config typescript errors

**Details/Why:**

---

## 2026-05-31 - 35bc61bea
**Change:** style: run prettier to fix formatting for CI

**Details/Why:**

---

## 2026-05-31 - 952804642
**Change:** fix: relax strict ESLint rules to unblock CI

**Details/Why:**

---

## 2026-05-31 - 77509f754
**Change:** build: add support for Linux builds (AppImage and deb)

**Details/Why:**

---

## 2026-05-31 - 53cc97759
**Change:** chore: implement tests, formatters, and address feedback

**Details/Why:**

---

## 2026-05-31 - a59a0fc4b
**Change:** Bump version to 0.0.1

**Details/Why:**

---

## 2026-05-31 - 1c0442269
**Change:** Enhance default tutorial notes with explicit examples and code snippets explanation

**Details/Why:**

---

## 2026-05-31 - 50e884dfe
**Change:** Add launch at startup setting

**Details/Why:**

---

## 2026-05-31 - b8ef7e0d2
**Change:** Auto-hide on blur and ignore dialogs

**Details/Why:**

---

## 2026-05-31 - 2afa3a306
**Change:** Permanently render window across all workspaces to fully prevent jumping

**Details/Why:**

---

## 2026-05-31 - 12f683101
**Change:** Fix window positioning across monitors and prevent space jumping

**Details/Why:**

---

## 2026-05-31 - d50451293
**Change:** Fix export dialog import and stop window centering on focus

**Details/Why:**

---

## 2026-05-31 - abc7ee851
**Change:** Update default toggle shortcut and improve active workspace pulling

**Details/Why:**

---

## 2026-05-31 - 27b34ddf5
**Change:** Add toggle shortcut setting and fix window spawning on active workspace

**Details/Why:**

---

## 2026-05-31 - 19ec34f3a
**Change:** Rename antipaper to papercache

**Details/Why:**

---

## 2026-05-31 - 0f104dd90
**Change:** updating readme

**Details/Why:**

---

## 2026-05-31 - 28cbe7161
**Change:** Update install instructions

**Details/Why:**

---

## 2026-05-31 - f4ff65571
**Change:** Add MIT License

**Details/Why:**

---

## 2026-05-31 - ef1abfe3a
**Change:** Update README.md

**Details/Why:**

---

## 2026-05-31 - eeb97b067
**Change:** Configure mac package build and update icon

**Details/Why:**

---

## 2026-05-31 - 07093fd44
**Change:** Initial commit of PaperCache

**Details/Why:**

---
