# New Features in v0.5.7

Welcome to PaperCache v0.5.7!

Here are the new features and improvements implemented in this release:
- **On-Demand Update Checks**: You can now manually check for updates directly from the Settings panel. Clicking "Check for Updates" provides immediate real-time feedback ("Checking…") while inquiring with GitHub releases.
- **Contextual Auto-Update & Restart**: Auto-updates have been completely overhauled with granular status tracking. When a new update finishes downloading in the background, a persistent toast notification appears featuring a prominent **"Restart Now"** button. You can now choose exactly when to restart and apply updates rather than experiencing unexpected application disruptions.
- **Robust CI & Release Manifests**: Fixed release workflow configuration so updater manifests (`latest.json`) are reliably generated on every release asset upload.
- **Code Quality & Build Hardening**: Resolved TypeScript strict build type checking across event listeners and improved countdown timer memory cleanup.

*(If you have read this note, feel free to delete it)*
