<div align="center">
  <img src="public/icon.png" width="128" height="128" alt="PaperCache Logo">
  
  # PaperCache
  **Your intelligent, minimalist markdown scratchpad.**
</div>

PaperCache is a lightning-fast, keyboard-centric scratchpad designed for developers, thinkers, and tinkerers. It combines the simplicity of markdown with powerful inline features like live math calculation, interactive variables, AI assistance, and seamless internal linking.

Available for **macOS** and **Windows**.

---

## ⚡️ Features

* **Live Markdown**: Write in markdown and see it instantly rendered inline. Click any text to jump back into raw edit mode.
* **Math & Variables**: Define variables (`/var x = 10`) and write equations (`x * 3 =`). PaperCache auto-calculates the result as you type. Change the variable, and the math updates instantly.
* **Inline AI Assistance**: Type `/ai <prompt>` and press enter to summon an AI assistant directly into your document.
* **Frictionless Organization**: Create folders simply by using `/` in your note names (e.g., `projects/app`). 
* **Global Hotkey**: Summon PaperCache from anywhere on your system with a custom global shortcut to quickly jot down a thought.
* **Graph View**: Visualize your connected thoughts and folders.

---

## 📸 Screenshots

*(Add screenshots of your application here)*
<div align="center">
  <img src="src/assets/hero.png" width="600" alt="App Screenshot">
</div>

---

## 📥 Download & Installation

### Releases
You can download the latest standalone `.app` (macOS) or `.exe` (Windows) directly from the [Releases](https://github.com/VariableThe/PaperCache/releases) page.

### Homebrew (macOS)
*(Coming soon)*
```bash
brew install --cask papercache
```

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

* **`Cmd/Ctrl + P`**: Quick Search / Switch Notes
* **`Cmd/Ctrl + K`**: Open Main Action Menu
* **`Cmd/Ctrl + N`**: Create New Note
* **`Cmd/Ctrl + + / -`**: Zoom In / Out
* **`Cmd/Ctrl + Click`**: Open internal file links or external web links

---

## 📄 License
MIT License.
