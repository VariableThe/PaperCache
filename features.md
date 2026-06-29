# PaperCache Features

This document outlines every feature available in the PaperCache codebase, organized by category.

## Editor & Formatting

- **Full Markdown Support**: Renders standard Markdown syntax directly inline using a custom CodeMirror setup. Hides Markdown formatting characters when the cursor is not active on them.
- **Custom Highlighting**: Select text and press `Cmd+H` to apply custom `==highlighting==`.
- **Code Snippets**: Supports triple backtick fenced code blocks with language-specific syntax highlighting, along with a built-in one-click "Copy Code" button that displays a checkmark upon success.
- **Color Format Recognition**: Automatically detects hex colors (e.g., `#D97757` or `#fff`) and renders a small inline preview color pill. Clicking on the circle in the color pill copies the hex code to your clipboard.
- **Date & Time Formats**: Highlights standard date (`DD-MM-YYYY` or `YYYY-MM-DD`) and time (`HH:MM` or `HH:MM:SS`) formats into clean, distinct pills.
- **Slash Command Autosuggest**: Type `/` to trigger an inline ghost-text autosuggest for commands like `/check`, `/task`, `/ai`, or `/ctx`. Press `Tab` to instantly complete the command without breaking your typing flow.
- **Interactive Checkboxes**: Type `/check` to create an interactive checkbox widget. Clicking it changes it to `/checked` and visually strikes through the text on that line!
- **Tasks & Reminders**: Type `/task` to create a task widget. Add a space followed by `@` and a time (like `1d2h`, `tmrw`, or a specific date `YYYY-MM-DD HH:MM`) to set a due date. Press `Cmd+R` to open the Tasks Page, which tracks all tasks, calculates due times, and highlights overdue tasks in red. Reminders fire native OS notifications via the Rust backend — reliable even when the app is minimized. Expired tasks are automatically removed from the list after 5 seconds to keep the UI clean.
- **Countdown Timers**: Type `/timer` or press `Cmd+T` to open the Timers panel. Create countdown timers with quick presets (5min, 10min, 25min, 1hr) or custom hours/minutes/seconds. Uses a drift-corrected chained `setTimeout` loop for accurate display. On completion, fires both a native OS notification and an in-app toast — even if the panel is closed.
- **Customizable Theming & Fonts**: Customize fonts, text colors, background colors, background images, and individual highlight colors for variables, AI, and math. Supports full dark mode (`grid-dark`, `blueprint`).

## Math, Variables, and Calculations

- **Reactive Math Calculations**: Type an equation followed by an `=` sign (e.g., `2+2=`), and PaperCache auto-calculates and appends the result instantly using a custom recursive-descent evaluator with zero external dependencies.
- **Local Variables**: Define variables inline using `/var name = value` (e.g., `/var x = 10`). These replace variables in text with clean pills and instantly recalculate math formulas anywhere in the note.
- **Global Variables**: Define variables that persist across _all_ notes using `/globvar name = value`. Any other note can reference them natively.
- **Auto-Reevaluation**: If a variable is updated anywhere, the entire document instantly recalculates and updates any dependent equations, acting as a lightweight spreadsheet inside a Markdown file.

## Knowledge Management & Linking

- **Note Folders**: Implicitly organize notes into folders by adding a `/` in the title (e.g., `projects/PaperCache.md`). Folders are auto-detected, color-coded, and cleanly removed from disk if they become empty.
- **Internal Note Linking**: Link to other notes using markdown links like `[link text](/file Note.md)` or simply `/file Note.md`. Click the link with `Cmd+Click` or `Ctrl+Click` to instantly navigate to it. URL links also open in the system browser.
- **Interactive Graph View** (`Cmd+G`): An interactive 2D knowledge graph rendered with Three.js WebGL. Nodes are clean flat circles with always-visible labels, edges are colored by opacity. Features:
  - **Folder Clustering**: Notes in the same folder are gently attracted toward a shared centroid, creating subtle visual groupings.
  - **Cmd+F Fuzzy Search**: Press `Cmd+F` inside graph view to fuzzy-search note names. Navigate with arrow keys, press Enter to fly the camera directly to the matched node.
  - **Multi-Format Link Detection**: Automatically detects connections via standard markdown links (`[Note](Note.md)`), wikilinks (`[[Note]]`), and `/file Note` syntax.
  - **Drag to Rearrange**: Nodes can be dragged freely; positions are cached and restored across graph sessions.
  - **Smooth Fade-in**: The graph overlay animates in with a 250ms fade.
  - **Lazy-Loaded**: The Three.js bundle (~1.3 MB) loads only when the graph is first opened, keeping startup fast.
- **Global Note Search**: Open an omnibar search (`Cmd+P`) to quickly fuzzy-search note contents and file names across the entire workspace.
- **Tagging System & Context Menu**: Add inline tags using `!tagname`. The global search bar aggregates all unique tags as clickable filters to quickly isolate notes. Right-click any tag pill to open an inline action menu, allowing you to bulk-delete or export all notes containing that tag into a single Markdown file.
- **Auto-Renaming**: Notes are auto-created with a timestamp ID. The title is intelligently inferred from the first line of the file (e.g., `# Header`), but can also be manually renamed by clicking the title bar.
- **Shortcuts Reference** (`Cmd+/` or `Cmd+?`): Press this anywhere in the app to open or create a `Shortcuts.md` note listing every keyboard shortcut and slash command.

## Artificial Intelligence

- **Inline AI Assistant**: Type `/ai <prompt>` and press enter to summon AI straight into your editor. Prompts are evaluated and automatically replaced with AI responses directly inline.
- **Note Context Injection**: Type `/ctx <prompt>` instead to automatically package the entire text of the current note along with your prompt, allowing the AI to read your document before answering.
- **Configurable Models & Custom Endpoints**: Easily switch out your API Key, System Prompt, API Base URL, and specific AI Model in the settings panel.
- **Free Top-Tier Defaults**: PaperCache comes fully pre-configured to point to OpenRouter's free tier, using powerful models like `nvidia/nemotron-3-super-120b-a12b:free` out of the box!
- **Secure API Storage**: API keys are securely encrypted at rest using your operating system's native keychain (via the Rust `keyring` crate).

## Desktop System Integration

- **Stealth / Background Mode**: Click away or lose focus, and the app instantly hides itself (macOS) or after a brief debounce (Windows/Linux — prevents accidental hide when dragging the title bar). On macOS, it runs as an "accessory" and hides its dock icon completely, acting like a true floating utility.
- **Intelligent Multi-Monitor Support**: When summoning the app via its global hotkey, it detects the active screen your mouse is currently on and brings the window instantly to that specific screen's workspace.
- **System Tray Icon**: A minimal system tray icon for toggling visibility or quitting the app cleanly, adapting to the user's OS theme (light/dark).
- **Global Hotkeys**: All shortcuts are fully customizable via Settings → Keybinds (`Cmd+Shift+S`). The keybinds modal lets you remap every action with live recording. A dedicated Keybinds Settings Panel provides a sleek modal with glassmorphic cards to view and remap all 11 application shortcuts. Defaults include:
  - `Cmd+Shift+N` (configurable): Spawn a new note from anywhere. If the app is already open, creates the note without hiding.
  - `Cmd+Shift+C` (configurable): Toggle PaperCache visibility from anywhere on your OS.
- **State Memory**: Memorizes precise window coordinates, dimensions, and zoom levels across launches to persist workspace state.
- **Fluid Settings**: Opening the Settings menu dynamically inherits the exact dimensions and on-screen coordinates of your current notepad for a native, seamless transition.
- **Launch on Startup**: Optional setting to boot silently in the background when your computer starts. The toggle stays synchronized with the actual OS login item state (visible in System Settings on macOS).
- **Exporting Options**: Export individual notes straight to a local `.md` file on your filesystem via the main menu or search list.
- **Smart Onboarding**: First-time users automatically open to a `Welcome.md` note with a complete feature overview. On version upgrades, PaperCache opens a "New Features" summary note and cleanly deletes older version notes behind the scenes.
- **Contextual Auto-Updates**: PaperCache checks for updates silently on startup. When checking, the Settings button shows "Checking…" feedback. When an update is downloaded, a persistent toast notification appears with a "Restart Now" button — no unexpected restarts.
- **About & Bug Reports**: Settings includes a dedicated About section showing the app logo, current version, a "Check for Updates" button, a Ko-fi support link, and a "Submit a Bug Report" button that opens a GitHub issue form.
- **Safe Tutorials**: Auto-generates fully functional Markdown tutorials in a `commands/` folder upon first launch. Prevents accidental deletion of these core tutorial files.
- **Node Positions Persist**: After closing the graph view, node positions are cached and restored on next open, preserving manual arrangement.
