# Agent Rules

## Safety & Process
- **Pull Requests Required**: Never push new features directly to the `main` branch. Always create a new branch and push your changes as a Pull Request (PR) for review.
- **Pre-PR Checks**: Run `npm run lint` and `npx vitest run` before opening any PR — don't open a PR with failing checks.
- **Preload/Types Contract**: Never modify `electron/preload.ts` or `src/types.d.ts` in isolation — these two files are a contract and must always be updated together.
- **Secrets Management**: Never store secrets, API keys, or credentials in code — API keys live in Electron's `safeStorage` only.

## Code Conventions
- **Zustand Slices**: Zustand stores must use slice subscriptions (`state => state.x`), never subscribe to the whole store.
- **IPC Listeners**: All `ipcRenderer.on` registrations in `preload.ts` must return an unsubscribe function.
- **Lazy Loading**: Dynamic `import()` for any dependency over 1MB unpacked — check with `npx cost-of-modules` before adding new deps.
- **Timers**: No `setInterval` in renderer or main process — use targeted `setTimeout` chains or event-driven patterns.

## Electron-specific
- **Security Context**: `contextIsolation: true` and `nodeIntegration: false` are non-negotiable — never change these.
- **IPC Types**: All new IPC channels must be declared in `src/types.d.ts` with proper types before use.
- **Power Management**: New background work in main process must handle `powerMonitor` suspend/resume events.

## Scope & Workflows
- **Focused PRs**: Don't refactor and add features in the same PR.
- **Performance Reporting**: Performance changes require a before/after bundle size comparison in the PR description (just paste the Vite build output).
