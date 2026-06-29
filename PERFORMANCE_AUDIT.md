# Performance Audit: PaperCache V0.5.8

**Date:** June 29, 2026
**Auditor:** VariableThe  
**App Version:** 0.5.8 (Tauri, custom arithmetic evaluator)  

## 1. Executive Summary

PaperCache is built on Tauri v2, Rust, and React. After migrating from Electron (v0.5.0-beta), we've continued shrinking the footprint through dependency removal, custom evaluators, and lazy-loading.

| Metric | V0.5.0-beta | V0.5.8 | Delta |
| :--- | :--- | :--- | :--- |
| **App Installer Size (DMG)** | ~7.3 MB | ~6.8 MB | **-7%** |
| **Idle RAM Usage** | ~40 MB | ~38 MB | **-5%** |
| **Idle CPU Usage** | 0.0% | 0.0% | **Maintained** |
| **Bundle Dependencies** | ~600 packages | ~590 packages | **Smaller** |

## 2. Testing Methodology & Environment
- **Hardware:** MacBook Air M4, 16GB RAM
- **OS:** macOS 15.7.5
- **Dataset:** Workspace containing 500 markdown notes, averaging 2KB each.
- **Tooling:** Activity Monitor, `ls -lh`, `du -sh`

## 3. Recent Performance Improvements (V0.5.3 — V0.5.8)

### Custom Arithmetic Evaluator (V0.5.8)
Replaced `expr-eval` (~15KB, high-severity prototype pollution vulnerability, no fix available) with a custom recursive-descent parser at `src/lib/evaluator.ts` (~2KB).
- Zero external dependencies — no `eval`, no `Function` constructors.
- ~150 lines of TypeScript with 26 unit tests.
- Not susceptible to prototype pollution.
- *Impact:* Eliminated a security vulnerability with a smaller, faster evaluator.

### Unused Dependency Removal (V0.5.6 — V0.5.8)
Removed 4 unused npm packages: `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell`, `@emnapi/core`, `@emnapi/runtime`.
- *Impact:* Reduced package.json weight and CI install times.

### Lazy-Loaded WebGL Graph View (V0.5.3)
Replaced D3.js Canvas 2D graph with `react-force-graph-3d` (Three.js/WebGL), dynamically imported via `React.lazy() + Suspense`.
- The Three.js bundle (~1.3 MB) loads **only** when the graph is first opened.
- *Impact:* Graph rendering is offloaded to the GPU. No startup penalty. No UI freeze on large graphs.

### DSL Regex Engine — Visible-Range Scanning (V0.5.3)
Created `dslPlugin.ts` — `createRegexPlugin()` scans only `view.visibleRanges` per update tick.
- O(visible lines) complexity instead of O(document length).
- *Impact:* Lag-free typing at any document size, even with many active regex rules. Eliminated the previous main-thread bottleneck for custom DSL parsing.

### Drift-Corrected Timer Countdowns (V0.5.3)
Replaced `setInterval` with chained `setTimeout` loops in the timer panel.
- *Impact:* No timer drift accumulation. Accurate countdowns regardless of browser event loop pressure.

### Debounced Saves (V0.4.0, maintained)
500ms debounce on `saveNote` IPC calls.
- Disk I/O reduced from ~3 writes/sec to ~1 write/sec during continuous typing.

### TypeScript Strict Mode (V0.5.8)
Enabled `strict: true` in tsconfig, catching null/type issues at compile time rather than runtime.
- *Impact:* Zero new type errors at enablement — the codebase was already compatible.

### Coverage Thresholds (V0.5.8)
Added minimum coverage guardrails to vitest config (statements 65%, branches 50%, functions 55%, lines 65%).
- *Impact:* Prevents silent coverage regression in CI.

## 4. Desktop Integration Overhead

- **Native API Key Storage:** Uses the OS keychain (macOS Keychain, Linux Secret Service, Windows Credential Manager) via the Rust `keyring` crate. No user-visible memory or latency cost.
- **Global Shortcuts:** Registered via `tauri-plugin-global-shortcut` — zero ongoing CPU overhead, fires events only on keypress.
- **Auto-Updates:** Uses `tauri-plugin-updater` — checks version metadata on startup (~1 HTTP HEAD request). No persistent overhead.
- **Window State Persistence:** Reads/writes a small JSON file (~200 bytes) on exit/startup. No runtime cost.

## 5. Known Limitations & Future Bottlenecks

1. **Full-Text Search:** Currently searches are done client-side via JavaScript string matching on loaded notes. For workspaces exceeding 5,000+ notes, this could introduce noticeable search latency. A future optimization could implement a persistent search index in Rust (e.g., via `tantivy` or `skim`).

2. **Graph Layout on Very Large Datasets:** The WebGL graph renders smoothly for typical workspaces (up to ~500 nodes). With 2,000+ nodes, force simulation convergence time and interaction framerate may degrade. Future optimization: implement LOD (level-of-detail) rendering or cluster-collapse for large folders.

3. **Startup Time (Cold):** Initial load requires parsing note directory via Rust's `walkdir` (~5ms for 500 notes) plus React hydration. The JS bundle is ~200KB gzipped. Cold launch is typically sub-second but varies by filesystem speed and note count.
