# New Features in v0.5.3

Welcome to PaperCache v0.5.3!

Here are the new features implemented in this version:
- **Redesigned Graph View**: Nodes are now rendered as clean, flat circles that properly occlude edges passing through them. Labels are always visible below each node. Circle size increased for better readability.
- **Cmd+F Fuzzy Search in Graph**: Press `Cmd+F` in graph view to fuzzy-search note names. Navigate results with arrow keys, press Enter to pan/zoom to the matched node.
- **Folder Clustering**: Notes in the same folder are gently attracted toward a shared centroid, creating subtle visual groupings. The graph still forms a single connected cluster.
- **Better Cmd+Shift+N Behavior**: When the app is already open, the global new-note shortcut now creates a new note without hiding the window. It only toggles visibility when the app is hidden.
- **Windows Focus-Loss Fix**: Clicking the title bar to drag or resize on Windows no longer accidentally hides the app.
- **Fresh Install Welcome**: First-time users now automatically open to the `Welcome.md` note with a feature overview.
- **Shortcuts Reference**: Press `Cmd+/` to open a `Shortcuts.md` note listing all keyboard shortcuts and slash commands.
- **Fade-in Animation**: The graph view now fades in smoothly when opened.
- **Lazy-Loaded Graph**: The Three.js graph engine is lazy-loaded, keeping the main bundle lean and startup fast.

*(If you have read this note, feel free to delete it)*
