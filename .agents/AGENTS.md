# Agent Rules

## Safety & Process
- **Pull Requests Required**: Never push new features directly to the `main` branch. Always create a new branch and push your changes as a Pull Request (PR) for review.
- **Pre-PR Checks**: Run `npm run lint` and `npx vitest run` before opening any PR — don't open a PR with failing checks.
- **Preload/Types Contract**: IPC contract: `src/types.d.ts` ↔ `src/api.ts` via `invoke()`. Never modify these files in isolation.
- **Secrets Management**: Never add secrets to Rust source — use keyring crate via `commands/keychain.rs`.

## Code Conventions
- **Zustand Slices**: Zustand stores must use slice subscriptions (`state => state.x`), never subscribe to the whole store.
- **Lazy Loading**: Dynamic `import()` for any dependency over 1MB unpacked — check with `npx cost-of-modules` before adding new deps.
- **Timers**: No `setInterval` in renderer or main process — use targeted `setTimeout` chains or event-driven patterns.

## Tauri & Rust
- **Security Context**: Follow Tauri's strict security model. Do not enable dangerous IPC scopes unless absolutely necessary.
- **IPC Types**: All new IPC channels must be declared in `src/types.d.ts` with proper types before use.
- **Asynchronous Rust**: Use `tauri::command(async)` for I/O bound operations in Rust to avoid blocking the main thread.

## Scope & Workflows
- **Focused PRs**: Don't refactor and add features in the same PR.
- **Performance Reporting**: Performance changes require a before/after bundle size comparison in the PR description (just paste the Vite build output).
- **Audit Logging**: Every change or significant update made must also be documented in `AUDIT_LOG.md`. Log what was done, when it was done, and why. Additionally, any user-facing changes (Added, Changed, Fixed, Performance, Security) must be documented in `CHANGELOG.md` under the appropriate release section.
