# Changelog

All notable, user-facing changes to PaperCache will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.5.0-beta] - 2026-06-23

### Added
- **Auto-Updates**: The app now checks for updates silently in the background on startup. A "Check for Updates Now" button was also added to the Settings menu.

### Changed
- The macOS distribution format is now `.tar.gz` and `.app` to circumvent strict macOS 14 runner restrictions with `osascript`. The Homebrew Cask automation pulls the `.tar.gz` bundle.

### Fixed
- Addressed multiple edge-cases with `CodeMirror` state overwrites causing typed text to disappear or duplicate.
- Fixed a bug where entering an empty string for the OpenAI API Key would incorrectly register as a valid key. The system now safely deletes the credentials.
- Standardized window show/hide toggling and ensured `Esc` correctly closes popovers.
- The `Quit` action now gracefully emits the proper shutdown events rather than force-killing the process, preventing data loss.

### Performance
- Eliminated scroll jank across the app by replacing broad CSS `transition: all` rules with targeted color and opacity transitions.
- Abstracted redundant window focus and visibility checks to speed up global shortcut responsiveness.

---

## [v0.4.0] - 2026-06-22

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
- **MathJS Optimization**: Implemented dynamic lazy-loading for the heavy `mathjs` dependency and debounced mathematical evaluations, significantly lowering baseline CPU usage.
- Fixed a memory leak involving power state IPC listeners that drained battery on macOS.

### Security
- **Production Hardening**: Removed unsafe `eval` usage in math processing.
- Restricted Tauri IPC scopes to only authorized directories (e.g. `~/.papercache`).

---

## [v0.2.0] - 2026-06-20

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

### Added
- **Initial Release**: PaperCache is born!
- System tray integration, auto-hide on blur, and global toggle capabilities.
- Markdown parsing, live variable tracking, and secure key storage.
