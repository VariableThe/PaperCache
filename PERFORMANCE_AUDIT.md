# Performance Audit: PaperCache V0.5.0-beta (Tauri Migration)

**Date:** June 22, 2026
**Auditor:** VariableThe  
**App Version:** 0.5.0-beta (Tauri Migration)  

## 1. Executive Summary (The TL;DR)
This document details the performance improvements made in V0.5.0-beta by migrating from Electron to Tauri and Rust. The primary goals were drastically reducing the application size and background RAM usage by eliminating the embedded Node.js runtime and Chromium binaries.

| Metric | V0.4.0 (Electron) | V0.5.0-beta (Tauri) | Delta |
| :--- | :--- | :--- | :--- |
| **App Installer Size (DMG)** | ~80.0 MB | ~7.3 MB | **-90%** |
| **Idle RAM Usage** | ~120 MB | ~40 MB | **-66%** |
| **Idle CPU Usage** | 0.0% | 0.0% | **Maintained** |
| **IPC Save Latency (500 notes)**| 12 ms (Async) | <5 ms (Rust fs) | **Faster** |

## 2. Testing Methodology & Environment
*To ensure reproducibility, all metrics were captured under the following conditions:*
- **Hardware:** MacBook Air M4, 16GB RAM (Baseline mid-tier dev machine).
- **OS:** macOS 15.7.5
- **Dataset:** Workspace containing 500 markdown notes, averaging 2KB each.
- **Tooling:** Activity Monitor, `ls -lh`, and Rust `std::time::Instant`.

## 3. The Tauri Migration (V0.5.0-beta)
*Goal: Remove the massive Electron overhead for a background utility.*

- **Zero-Copy IPC via `serde`:** Electron relies on JSON stringification over a Node.js bridge. Tauri uses Rust's `serde` library, which serializes and deserializes IPC payloads with near-zero overhead, making data transfer between the UI and backend virtually instantaneous.
- **Native Async Runtime:** The Rust backend utilizes the `tokio` multi-threaded async runtime. Heavy operations like recursive directory walking (`get_notes`) and HTTP requests (`reqwest` for OpenAI) are executed off the main thread, ensuring the UI never stutters during disk I/O.
- **Native Security:** Replaced Electron's `safeStorage` with a custom Rust implementation using the `keyring` crate (for OS-level credential storage) and `aes-gcm` (for AES-256-GCM encryption). This provides hardware-backed security with a fraction of the memory footprint.
- **Strict Capability Scoping:** Migrated to Tauri v2's capability system, ensuring the frontend can only invoke explicitly whitelisted Rust commands and access strictly scoped file paths, eliminating entire classes of XSS-to-filesystem vulnerabilities present in Electron.

---

## Historical: V0.4.0 Performance Audit

## 3. Bundle & Ship Size Optimization
*Goal: Reduce the amount of JavaScript V8 must parse on cold start.*

- **Removed `mathjs` (16MB):** Replaced with `expr-eval` (160KB). 
  - *Impact:* Reduced initial JS parse time by ~400ms.
- **Removed `openai` Node SDK (16MB):** Replaced with native `fetch()` (20 lines of code).
  - *Impact:* Eliminated 16MB of dead weight. The AI feature now lazy-loads only when triggered, but the base bundle is permanently smaller.
- **Vite Code Splitting:** Verified that heavy CodeMirror language parsers are dynamically imported only when a specific code block is rendered.

## 4. Main Process & IPC Architecture
*Goal: Prevent the Electron main thread from blocking on disk I/O, which causes global hotkey lag and tray menu freezes.*

- **Async File I/O:** Migrated 8 synchronous `fs.*Sync` calls in IPC handlers (`get-notes`, `save-note`, etc.) to `fs.promises`.
  - *Before:* Loading 500 notes blocked the main thread for 450ms. The UI was completely unresponsive.
  - *After:* Loading 500 notes uses `Promise.all()` and takes 12ms of main-thread time. 
- **Startup Bootstrap:** Left 2 synchronous `existsSync`/`mkdirSync` calls in the pre-app-ready bootstrap phase for creating `.papercache` and `commands` directories.
  - *Justification:* These run before the `BrowserWindow` is created. Making them async adds complexity for zero user-perceptible benefit.

## 5. Renderer & React State
*Goal: Eliminate UI stuttering during rapid typing and state updates.*

- **Debounced Saves:** Implemented a 500ms debounce on `window.electronAPI.saveNote`. 
  - *Impact:* Disk I/O reduced from ~3 writes/sec to 1 write/sec during continuous typing.
- **Pure State Updaters:** Refactored `App.tsx` to remove IPC side-effects from `setNotes` updaters. 
  - *Impact:* Eliminated React "Cannot update a component while rendering a different component" warnings and prevented double-saving race conditions.
- **Window Consolidation:** Removed the secondary `BrowserWindow` for Settings. 
  - *Impact:* Saved ~40MB of baseline RAM (no second Chromium renderer process) and eliminated the fragile `localStorage` event listener sync.

## 6. Known Limitations & Future Bottlenecks
*Intellectual honesty: Where the app is still not perfectly optimized, and why.*

1. **Graph View Rendering:** The D3.js graph view currently recalculates the entire force-directed layout on every node addition. With 1,000+ notes, this causes a 2-second UI freeze. 
   - *Mitigation:* We accept this for V0.4.0 as graph view is a secondary feature. V0.5.0 will implement WebGL (via `react-force-graph`) to offload layout calculations to the GPU.
2. **Regex Parsing on Large Files:** The custom DSL regex runs on the entire document string on every keystroke. For files >50KB, this causes minor input latency in the JS main thread.
   - *Mitigation:* In V0.5.0, this parsing can be ported to a `#[tauri::command]` in Rust. Rust's regex engine is highly performant and completely bypasses the JS main thread, eliminating input latency without needing Web Workers.
