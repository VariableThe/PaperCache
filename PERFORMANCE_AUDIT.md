# Performance Audit: PaperCache V0.4.0

**Date:** October 26, 2024  
**Auditor:** VariableThe  
**App Version:** 0.4.0 (Post-Refactor)  

## 1. Executive Summary (The TL;DR)
This document details the performance improvements made in V0.4.0. The primary goals were eliminating main-thread I/O blocking, reducing the initial JS parse time, and fixing React state-induced UI stutters.

| Metric | V0.3.0 (Baseline) | V0.4.0 (Current) | Delta |
| :--- | :--- | :--- | :--- |
| **Initial Bundle Size (JS)** | 18.4 MB | 1.1 MB | **-94%** |
| **Cold Start to Interactive** | 1,450 ms | 320 ms | **-77%** |
| **Idle CPU Usage** | 2.5% | 0.0% | **Zero polling** |
| **IPC Save Latency (500 notes)**| 450 ms (UI Freeze) | 12 ms (Async) | **Non-blocking** |

## 2. Testing Methodology & Environment
*To ensure reproducibility, all metrics were captured under the following conditions:*
- **Hardware:** MacBook Air M4, 16GB RAM (Baseline mid-tier dev machine).
- **OS:** macOS 15.7.5
- **Dataset:** Workspace containing 500 markdown notes, averaging 2KB each.
- **Tooling:** Chromium DevTools (Performance & Memory tabs), Electron `process.memoryUsage()`, and custom `performance.mark()` IPC timers.

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
   - *Mitigation:* We accept this for V0.4.0 as graph view is a secondary feature. V0.5.0 will implement WebGL (via `react-force-graph`) or web workers for layout calculation.
2. **Regex Parsing on Large Files:** The custom DSL regex runs on the entire document string on every keystroke. For files >50KB, this causes minor input latency.
   - *Mitigation:* CodeMirror's incremental parsing helps, but we may need to move the DSL parser to a Web Worker in the future.
