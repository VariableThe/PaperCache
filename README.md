<div align="center">
  <img src="public/icon.png" width="128" height="128" alt="PaperCache Logo">
  
  # PaperCache
  **Your intelligent, minimalist markdown scratchpad.**
</div>

PaperCache is a lightning-fast, keyboard-centric scratchpad designed for developers, thinkers, and tinkerers. It combines the simplicity of markdown with powerful inline features like live math calculation, interactive variables, AI assistance, and seamless internal linking.

Available for **macOS** and **Windows**.

---

## ⚡️ Features

- **Live Markdown**: Write in markdown and see it instantly rendered inline. Click any text to jump back into raw edit mode.
- **Math & Variables**: Define variables (`/var x = 10`) and write equations (`x * 3 =`). PaperCache auto-calculates the result as you type. Change the variable, and the math updates instantly.
- **Inline AI Assistance**: Type `/ai <prompt>` and press enter to summon an AI assistant directly into your document. (Requires your own OpenAI API key, configured in Settings).
- **Frictionless Organization**: Create folders simply by using `/` in your note names (e.g., `projects/app`).
- **Global Hotkey**: Summon PaperCache from anywhere on your system with a custom global shortcut to quickly jot down a thought.
- **Graph View**: Visualize your connected thoughts and folders.
- **Local & Private**: Your notes live as plain markdown files on your local disk in the `~/.papercache` directory. AI queries go directly to OpenAI, with no middlemen.

---

## 📸 Screenshots

<div align="center">
  <img src="preview%20images/editor.png" width="700" alt="Live Markdown Editor">
  <p><strong>Live Markdown Editor</strong> — Inline rendering, math, variables, and internal links.</p>
  <br>
  <img src="preview%20images/ai-assistance.png" width="700" alt="Inline AI Assistance">
  <p><strong>Inline AI Assistance</strong> — Type <code>/ai &lt;prompt&gt;</code> and get answers instantly.</p>
  <br>
  <img src="preview%20images/graph-view.png" width="700" alt="Graph View">
  <p><strong>Graph View</strong> — Visualize your connected notes and folders.</p>
  <br>
  <img src="preview%20images/sidebar.png" width="700" alt="Note Sidebar">
  <p><strong>Frictionless Organization</strong> — Search, folders, and quick navigation.</p>
</div>

---

## 📥 Download & Installation

### Releases

You can download the latest standalone `.app` (macOS) or `.exe` (Windows) directly from the [Releases](https://github.com/VariableThe/PaperCache/releases) page.

### Homebrew (macOS)

```bash
brew tap variablethe/tap
brew install --cask papercache
```

> [!NOTE]
> If you manually download the `.zip` from Releases and macOS blocks the app from opening because it is from an "unidentified developer", simply run this command in your terminal to clear the quarantine flag:
>
> ```bash
> xattr -cr /Applications/PaperCache.app
> ```

---

## 🛠 Build from Source

PaperCache is built using **Electron**, **React**, **TypeScript**, and **Vite**.

1. **Clone the repository**

   ```bash
   git clone https://github.com/VariableThe/PaperCache.git
   cd PaperCache
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run in development mode**

   ```bash
   npm run dev
   ```

4. **Package the app**
   To build a standalone executable for your operating system:
   ```bash
   npm run package
   ```
   The compiled application will be located in the `release/` directory.

---

## ⌨️ Shortcuts

- **`Cmd/Ctrl + P`**: Quick Search / Switch Notes
- **`Cmd/Ctrl + K`**: Open Main Action Menu
- **`Cmd/Ctrl + N`**: Create New Note
- **`Cmd/Ctrl + + / -`**: Zoom In / Out
- **`Cmd/Ctrl + Click`**: Open internal file links or external web links

---

## 📄 License

MIT License.
