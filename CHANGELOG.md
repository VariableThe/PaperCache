# Changelog

All notable, user-facing changes to PaperCache will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
