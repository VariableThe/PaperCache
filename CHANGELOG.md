# Changelog

All notable, user-facing changes to PaperCache will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Contextual Auto-Update UI**: When checking for updates in Settings, visual feedback is now displayed ("Checking…"). When an update is downloaded and ready, a persistent toast notification appears with a prominent "Restart Now" button so users can restart when convenient rather than experiencing unexpected application restarts.

### Changed
- **Code Quality & Test Reliability**: Refactored global shortcut registration to remove duplicate event handling logic in the backend. Improved countdown timer cleanup reliability by properly tracking and clearing async timeouts when timers complete or are removed. Added comprehensive unit tests for inline DSL variable evaluation (`VariableScope`).

### Fixed
- **Updater Artifact Manifest Generation**: Fixed an issue where auto-updates failed due to missing or improperly configured updater manifests (`latest.json`) in GitHub release assets.
- **CI Workflow Hardening**: Disabled persisted checkout credentials in GitHub Actions release workflow and explicitly specified the stable Rust toolchain selector.

## [v0.5.6] - 2026-06-28

### Added
- **Dedicated Keybinds Settings Panel**: Added a sleek, high-contrast dark modal accessible from Settings (`Cmd+Shift+S`) to view and remap all application shortcuts with live recording. Designed with rich typography, glassmorphic cards, and fixed-width input buttons for perfectly vertically aligned shortcut columns.

### Changed
- **Updated Default Shortcut Mappings**: Shifted the Reminders/Tasks view shortcut to `Cmd+R` and Timers panel shortcut to `Cmd+T`.
- **Timer Auto-Deletion**: Expired countdown timers are now automatically removed from the active list 5 seconds after completing, keeping the UI clean. Timer completion notifications and auto-cleanup now function globally even when the Timers panel is closed.
- **Enhanced Graph View Link Parsing**: Extended 3D Graph View link detection to support standard markdown links (`[Note](Note.md)`) and wikilinks (`[[Note]]`) alongside the existing `/file` syntax, and added z-axis forces for improved 3D layout stability.
- **Code Quality Cleanup**: Consolidated repetitive boilerplate across stores, event listeners, and UI components; extracted ~25 magic numbers into named constants; removed dead code and pedagogical AI-style comments.
- **Improved Type Safety**: Replaced `any` with typed interfaces in GraphView; properly typed `openAIChat` API response; aligned async method return types across bridge API.
- **Rust Lint Cleanup**: Fixed clippy warnings in notifications.rs; documented suppressions for legacy objc crate macro warnings.

### Security
- **CI Supply-Chain Protection**: Pinned all third-party GitHub Action references in release workflow (`release.yml`) to immutable SHA-1 digests to protect release signing keys against supply-chain attacks.
- **Repository Hygiene**: Removed committed release build artifacts (`*.app.tar.gz`) from repository tracking and updated `.gitignore` to prevent leaking build binaries into git history.

## [v0.5.5] - 2026-06-27

### Added
- **Smart Onboarding & New Features Note Routing**: Brand new installations now cleanly launch directly into `Welcome.md` without copying or showing release note files. Existing users upgrading from previous versions will automatically receive the release notes file and be taken directly to the `New Features in v0.5.5.md` note upon opening the app.
- **Settings Bug Report & About Menu**: Added a "Submit a Bug Report" button under System settings linking directly to the GitHub issue creation form. Added a dedicated "About" section displaying the app logo, current version number, update checker, Ko-fi support link, and a thank you message.

### Fixed
- **API Key Persistence & Clearing**: Fixed an issue where clicking "Save Settings" without re-entering an API key unintentionally cleared existing keys from the OS keyring. Added an explicit "Clear Key" button and defensive trimming before saving credentials securely. Also improved macOS keyring replacement logic to prevent duplicate item errors.
- **Graph View crash on navigation & toggle**: Fixed `fg.graphData is not a function` TypeError when navigating to notes or toggling Graph View (`Cmd+G`) by adding defensive checks before invoking ref methods on component unmount and falling back to a ref cache. Also replaced `setInterval` with a chained `setTimeout` loop.
- **Windows Onboarding File Linking & Generation**: Fixed a bug on Windows where backslashes in generated note IDs caused internal `/file` links in `Welcome.md` to fail and create duplicate empty notes. Normalized note ID generation across Rust and TypeScript to consistently use forward slashes on all platforms, and ensured onboarding template files regenerate correctly on application updates.
- **Window position/size now persists across restarts**: The window-state plugin's `on_window_ready` fires before the macOS display server is ready, causing `available_monitors()` to return empty and the saved position to be silently discarded. Fixed by deferring window-state restoration via a background thread + `run_on_main_thread` 300ms after `setup()` completes, bypassing the plugin's monitor-intersection check with a direct file read. Both the tray "Quit" and Settings "Quit" buttons now explicitly save window state before exit.
- **Launch at Startup now registers as a proper Login Item**: Changed `MacosLauncher` from `LaunchAgent` to `AppleScript`, which registers PaperCache in System Settings > General > Login Items instead of creating a hidden `launchd` plist. Users can now see and manage the autostart entry directly from System Settings.
- **Window no longer shifts down on restart on macOS**: Removed the +/-28px compensation that was incorrectly added for a macOS frameless window offset which does not exist in `tauri-plugin-window-state` v2.4.1 — the plugin correctly saves `outer_position()` and restores via `set_position()` with no titlebar offset for frameless windows.
- **Shortcut key pill "+" centered between key caps**: The `+` separator in the shortcut display was grouped inside the same `<span>` as the key cap to its left with `justify-content: space-evenly`, making it appear visually attached to the left pill. Restructured to a flat flex layout with `gap` so the `+` is independently centered with equal spacing on both sides.
- **Login-item toggle stays in sync with macOS System Settings**: The launch-at-startup toggle only read from `localStorage`, so removing PaperCache from System Settings left the toggle permanently stuck in the checked state. Fixed by adding a `get_launch_at_startup` Tauri command that queries the actual OS login-item state via `app.autolaunch().is_enabled()`, and syncing the toggle with the real OS state on every Settings mount.
- **Scrollbars hidden on Windows/Linux in Settings and editor**: `.settings-content` and `.editor-container` had `overflow-y: auto`/`overflow: auto` but no scrollbar-hiding rules. macOS overlay scrollbars auto-hide, but Windows/Linux show persistent scrollbars. Added `scrollbar-width: none` (Firefox), `-ms-overflow-style: none` (IE/Edge legacy), and `::-webkit-scrollbar { display: none }` (Chrome/Safari/Edge Chromium) to both containers.
- **ESC no longer hides the window when an overlay is open**: The global hotkey handler was calling `window.hide()` before checking whether the graph view, timer panel, or reminders panel was open. Pressing Escape now correctly dismisses the top-most overlay first; the window only hides as a last resort.
- **IPC error handling for shell/file commands**: `openExternal`, `openFile`, `setLaunchAtStartup`, and `quitApp` now properly propagate backend errors to the caller instead of silently discarding the Promise.
- **Update notification before restart**: When an auto-update is ready, PaperCache now shows a toast ("PaperCache updated — restarting in 3 seconds…") for 3 seconds before restarting, so users are never caught off-guard.
- **Pause button removed from timer panel**: The ⏸ pause button had no corresponding resume path (backend not implemented). Removed to avoid a dead-end UX; the close/remove button remains.
- **Resolved production build TypeScript errors**: Fixed strict compilation failures in GraphView (`d3Force`, `cameraPosition`, ref assignment) and unit test setup (`onUpdateReady`).

## [v0.5.3] - 2026-06-24

### Added
- **Redesigned Graph View**: Nodes are now flat `CircleGeometry` with `depthWrite: true` and `renderOrder: 1` in the transparent pass, cleanly occluding edges behind them. Always-visible canvas-based text labels positioned below each node.
- **Cmd+F Fuzzy Search in Graph**: Press `Cmd+F` in graph view to search note names by fuzzy character matching. Navigate with arrow keys, confirm with Enter to fly the camera to the matching node.
- **Folder Clustering**: Notes sharing a folder are weakly attracted to a shared centroid via forceX/forceY at 0.008 strength, producing subtle visual grouping without breaking the unified cluster.
- **Cmd+/ Shortcuts Reference**: Press `Cmd+/` (or `Cmd+?`) to open or create a `Shortcuts.md` note listing all keyboard shortcuts and slash commands.
- **Fresh Install Welcome**: First-time launch now opens `Welcome.md` instead of looking for a new-features note. The welcome note has been revamped with a full feature overview.
- **Lazy-Loaded Graph**: `GraphView` is dynamically imported with `React.lazy()` so the Three.js bundle (~1.3 MB) loads only when the graph is opened.
- **Smooth Graph Fade-in**: The graph overlay animates in with a 250ms CSS keyframe fade.
- **Persistent Node Positions**: After closing the graph view, node positions are cached and restored on next open, preserving manual arrangement.
- **Native OS Reminder Notifications**: Task reminders (`/task`) now fire native OS notifications via the Rust backend using `tokio::time::sleep` + `tauri_plugin_notification`. Notifications fire reliably even when the app is minimized or out of focus, and gracefully handle OS-level permission denials.
- **Countdown Timers**: New timer panel (accessible via the action menu or `/timer` command) lets you create, view, pause/resume, and cancel countdown timers. Timers display a live countdown using drift-corrected `setTimeout` chains and trigger both a native OS notification and an in-app alert on completion — even if you're viewing a different note.
- **DSL Regex Parsing Engine**: New `createRegexPlugin()` factory in `dslPlugin.ts` enables flexible, regex-based Domain Specific Language parsing in the editor. Scans only visible ranges for O(visible lines) performance — lag-free at any document size. Supports custom mark decorations, widget injections, and match callbacks.
- **WebGL Graph View**: The Graph View has been rewritten using Three.js WebGL via `react-force-graph-3d`. Notes in the same folder are attracted to shared centroid positions via custom `d3-force` simulation rules, causing them to cluster together naturally. The graph is lazy-loaded to avoid impacting editor startup time.

### Changed
- **Cmd+Shift+N Behavior**: The global new-note shortcut no longer hides the app if it's already visible. It only shows the window when hidden. The shortcut always creates a new note regardless.
- **Node Circle Size**: Increased from radius 8 to 12, with labels shifted and scaled accordingly.
- **Windows Focus-Loss Debounce**: Hiding on focus loss now uses a 200ms debounce to prevent accidental hide when clicking the title bar for drag or resize.
- **Node Positions Cache**: Force simulation no longer pushes dragged nodes back — the strength accessor skips nodes in the dragged set.
- **Graph Controls**: OrbitControls configured with `enableRotate = false`, `LEFT = PAN`, `MIDDLE = DOLLY` for a pure 2D navigation experience.

### Fixed
- Fixed edges/lines showing through circle nodes by making circle meshes render in the transparent pass after links.
- Fixed graph view opening inside the shortcut handler (removed stale `showGraphView` setter call from version check effect).
- Fixed blank graph issue on re-open by caching node positions at component unmount.

---

## [v0.5.2] - 2026-06-24

### Added
- **Slash Command Autosuggest**: Added an inline ghost text autosuggest widget for slash commands (e.g., `/check`, `/ai`). Pressing `Tab` instantly completes the command without interrupting typing flow.
- **Auto-Open Version Notes**: Upon updating, PaperCache now automatically opens a summary note detailing the new features in the latest release and silently cleans up previous version notes from the workspace.
- **Tag Context Menu**: Right-clicking a tag pill now reveals a beautifully styled inline action menu allowing users to easily delete all notes under that tag, or export them concatenated together into a single Markdown file directly via native system dialogs.

### Fixed
- Fixed an issue where the unified search view layout could overlap with the context menu or hide important tag management options.
- The `/task-done` command has been streamlined down to `/check` for clarity and better UX alignment.

---

## [v0.5.0-beta] - 2026-06-23

### Highlights
- 🚀 Migrated from Electron to Tauri
- ⚡ Automatic updates
- 🪟 Improved window behavior
- 🐞 Major stability improvements

### Added
- **Auto-Updates**: The app now checks for updates silently in the background on startup. A "Check for Updates Now" button was also added to the Settings menu.

### Changed
- **Tauri Migration**: PaperCache has been fully migrated from Electron to Tauri, reducing memory usage, startup time, and application size while preserving existing workflows.
- The macOS distribution format is now `.tar.gz` and `.app` to circumvent strict macOS 14 runner restrictions with `osascript`. The Homebrew Cask automation pulls the `.tar.gz` bundle.
- **Keybindings**: Changed default global and internal keybindings from `Ctrl/Cmd` to `Alt` to prevent conflicts with terminal emulators and OS shortcuts.
- **Window Behavior**: Disabled the "hide on focus loss" behavior so the application acts as a standard window, fixing global shortcut limitations on Wayland compositors (like Hyprland).

### Fixed
- Addressed multiple edge-cases with `CodeMirror` state overwrites causing typed text to disappear or duplicate.
- Fixed a bug where entering an empty string for the OpenAI API Key would incorrectly register as a valid key. The system now safely deletes the credentials.
- Improved window behavior and consistency across Windows, macOS, and Linux.
- The `Quit` action now gracefully emits the proper shutdown events rather than force-killing the process, preventing data loss.

### Performance
- Eliminated scroll jank across the app by replacing broad CSS `transition: all` rules with targeted color and opacity transitions.
- Abstracted redundant window focus and visibility checks to speed up global shortcut responsiveness.

---

## [v0.4.0] - 2026-06-22

### Highlights
- ⌨️ Global Shortcut Recorder
- ✅ Tasks Integration
- 🧠 State Management Refactor
- 🏎️ MathJS Optimization

### Added
- **Global Shortcut Recorder**: Added a UI in Settings to record custom keybindings for toggling the app and creating new notes.
- **Tasks Integration**: Support for inline checkboxes and a dedicated Tasks view.
- Added support for interactive hex color pills and currency formatting.
- The application now persists and reopens the last active note on startup.

### Changed
- **State Management**: Migrated the core frontend architecture to `Zustand` for cleaner, slice-based state management.
- Normalized font stacks and refined typography weights for improved readability across themes.

### Fixed
- Fixed an issue where internal wiki links (`[[link]]`) would accidentally overwrite adjacent text on auto-complete.
- Resolved race conditions in variable evaluation (`useVariables`).
- Fixed the Settings window so that it properly tracks the bounds of the main window.

### Performance
- **MathJS Optimization**: Implemented dynamic lazy-loading and debounced evaluations, dramatically reducing idle CPU usage and startup overhead.
- Fixed a memory leak involving power state IPC listeners that drained battery on macOS.

### Security
- **Production Hardening**: Removed unsafe `eval` usage in math processing.
- Restricted Tauri IPC scopes to only authorized directories (e.g. `~/.papercache`).

---

## [v0.3.0] - Skipped

_This version was not released._

---

## [v0.2.0] - 2026-06-20

### Highlights
- 🧮 Core mathematical evaluation logic
- 📏 Horizontal rules and styling

### Added
- Implemented core mathematical evaluation logic and inline widgets.
- Added horizontal rules (`---`) styling and custom colors for math results.

### Changed
- Improved the default onboarding tutorial notes with deeper feature explanations.

### Fixed
- Fixed Prettier formatting mismatches that were breaking the CI pipeline.
- Fixed an issue with window spawning on the wrong active workspace.

---

## [v0.1.0] - 2026-05-31

### Highlights
- 🎉 Initial Release of PaperCache!

### Added
- **Initial Release** of PaperCache.
- Global hotkey launcher with floating markdown editor.
- Live markdown rendering with inline math and variables.
- System tray integration.
- Auto-hide on blur.
- Cross-platform desktop support.
