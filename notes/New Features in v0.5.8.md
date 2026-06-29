# New Features in v0.5.8

Welcome to PaperCache v0.5.8!

Here are the new features and improvements implemented in this release:
- **Safer & Faster Math Evaluation**: Replaced the `expr-eval` library (which had a high-severity prototype pollution vulnerability) with a new custom-built arithmetic evaluator. It's smaller, faster, and has zero external dependencies. All your inline math, variables (`/var`, `/globvar`), and re-evaluations work exactly as before.
- **Stronger Type Safety**: Enabled TypeScript's strict mode across the entire project, catching latent null/type issues at compile time. The `onEvent` helper in the API layer is now properly generic-typed instead of using `any`.
- **Cleaner Dependency Tree**: Removed 4 unused packages (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell`, `@emnapi/core`, `@emnapi/runtime`), reducing install size.
- **Test Coverage Guardrails**: Added minimum coverage thresholds to the test runner so drops in coverage are caught in CI.

*(If you have read this note, feel free to delete it)*
