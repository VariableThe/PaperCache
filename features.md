# PaperCache Features

This document outlines every feature available in the PaperCache codebase, organized by category.

## Editor & Formatting

- **Full Markdown Support**: Renders standard Markdown syntax directly inline using a custom CodeMirror setup. Hides Markdown formatting characters when the cursor is not active on them.
- **Custom Highlighting**: Select text and press `Cmd+H` to apply custom `==highlighting==`.
- **Code Snippets**: Supports triple backtick fenced code blocks with language-specific syntax highlighting, along with a built-in one-click "Copy Code" button that displays a checkmark upon success.
- **Color Format Recognition**: Automatically detects hex colors (e.g., `#D97757` or `#fff`) and renders a small inline preview color pill.
- **Date & Time Formats**: Highlights standard date (`YYYY-MM-DD`) and time (`HH:MM` or `HH:MM:SS`) formats into clean, distinct pills.
- **Customizable Theming & Fonts**: Customize fonts, text colors, background colors, background images, and individual highlight colors for variables, AI, and math. Supports full dark mode (`grid-dark`, `blueprint`) and custom zoom scaling.

## Math, Variables, and Calculations

- **Reactive Math Calculations**: Type an equation followed by an `=` sign (e.g., `2+2=`), and PaperCache auto-calculates and appends the result instantly (using `mathjs`).
- **Local Variables**: Define variables inline using `/var name = value` (e.g., `/var x = 10`). These replace variables in text with clean pills and instantly recalculate math formulas anywhere in the note.
- **Global Variables**: Define variables that persist across _all_ notes using `/globvar name = value`. Any other note can reference them natively.
- **Auto-Reevaluation**: If a variable is updated anywhere, the entire document instantly recalculates and updates any dependent equations, acting as a lightweight spreadsheet inside a Markdown file.

## Knowledge Management & Linking

- **Note Folders**: Implicitly organize notes into folders by adding a `/` in the title (e.g., `projects/PaperCache.md`). Folders are auto-detected, color-coded, and cleanly removed from disk if they become empty.
- **Internal Note Linking**: Link to other notes using markdown links like `[link text](/file Note.md)` or simply `/file Note.md`. Click the link with `Cmd+Click` or `Ctrl+Click` to instantly navigate to it. URL links also open in the system browser.
- **Interactive Graph View**: An interactive, visual 2D node graph (`Cmd+G`) showing all connected notes, color-coded automatically based on their implicit folder. Click a node to open it.
- **Global Note Search**: Open an omnibar search (`Cmd+P`) to quickly fuzzy-search note contents and file names across the entire workspace.
- **Tagging System**: Add inline tags using `!tagname`. The global search bar aggregates all unique tags as clickable filters to quickly isolate notes.
- **Auto-Renaming**: Notes are auto-created with a timestamp ID. The title is intelligently inferred from the first line of the file (e.g., `# Header`), but can also be manually renamed by clicking the title bar.

## Artificial Intelligence

- **Inline AI Assistant**: Type `/ai <prompt>` and press enter to summon OpenAI straight into your editor. Prompts are evaluated and automatically replaced with AI responses directly inline.
- **Configurable Models & Custom Endpoints**: Easily switch out your API Key, System Prompt, API Base URL, and specific AI Model (`gpt-4o`, `gpt-3.5-turbo`, or custom local LLM endpoints) in the settings panel.

## Desktop System Integration

- **Stealth / Background Mode**: Click away or lose focus, and the app instantly hides itself. On macOS, it runs as an "accessory" and hides its dock icon completely, acting like a true floating utility.
- **Intelligent Multi-Monitor Support**: When summoning the app via its global hotkey, it detects the active screen your mouse is currently on and brings the window instantly to that specific screen's workspace.
- **System Tray Icon**: A minimal system tray icon for toggling visibility or quitting the app cleanly, adapting to the user's OS theme (light/dark).
- **Global Hotkeys**:
  - `Cmd+Shift+N` (configurable): Instantly spawn a new floating note from anywhere on your OS.
  - `Cmd+Shift+C` (configurable): Toggle PaperCache visibility from anywhere on your OS.
- **State Memory**: Memorizes precise window coordinates, dimensions, and zoom levels across launches to persist workspace state.
- **Launch on Startup**: Optional setting to boot silently in the background when your computer starts.
- **Exporting Options**: Export individual notes straight to a local `.md` file on your filesystem via the main menu or search list.
- **Safe Tutorials**: Auto-generates fully functional Markdown tutorials in a `commands/` folder upon first launch. Prevents accidental deletion of these core tutorial files.
