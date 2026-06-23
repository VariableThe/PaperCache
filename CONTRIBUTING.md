# Contributing to PaperCache

First of all, thank you for considering contributing to PaperCache!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/VariableThe/PaperCache.git
   cd PaperCache
   ```

2. **Install dependencies:**
   We strictly use `npm ci` to ensure reproducible builds.
   ```bash
   npm ci
   ```

3. **Start the Tauri development server:**
   ```bash
   npm run tauri dev
   ```
   > **Prerequisite:** A [Rust toolchain](https://rustup.rs) is required to compile the native backend.

## Development Guidelines
- **Pull Requests Required**: Never push new features directly to the `main` branch. Always create a new branch and push your changes as a Pull Request (PR) for review.
- **Pre-PR Checks**: Run `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run test` before opening any PR — don't open a PR with failing checks.
- **Performance Reporting**: Performance changes require a before/after bundle size comparison in the PR description (just paste the Vite build output).
- **Audit Logging**: Every change or significant update made must also be documented in `AUDIT_LOG.md`. Log what was done, when it was done, and why. Additionally, any user-facing changes (Added, Changed, Fixed, Performance, Security) must be documented in `CHANGELOG.md` under the appropriate release section.

Thank you for your contributions!
