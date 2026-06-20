<div align="center">
  <img src="public/icon.png" width="128" height="128" alt="PaperCache Logo">
  
  # PaperCache
  **A floating markdown scratchpad for developers and power users.**
</div>

Summon it with a hotkey. Jot. Dismiss. It stays out of your way until you need it.

---

## What makes it different

- **Lives in the background** — no dock icon, no window chrome. Press your hotkey, it appears on whatever screen your mouse is on. Click away, it vanishes.
- **Reactive math & variables** — define `/var x = 10`, write `x * 3 =`, get `30`. Change the variable, everything updates. Works across notes with `/globvar`.
- **Inline AI** — type `/ai <prompt>`, press enter, get the answer inserted directly into your note. No sidebar, no context switch.
- **Auto-highlights hex colors, dates, and times** — `#D97757` renders as a color pill. `31-05-2024` gets highlighted. Useful at a glance.
- **Interactive Checkboxes** — Type `/check` to create an interactive checkbox that strikes through text when clicked.
- **Tasks & Reminders** — Type `/task` followed by `@ 1d2h` to set a due date. Press `Cmd+T` to open a unified Tasks view that tracks all your pending items and due times.
- **Tags & folders** — `!tagname` for tags, `/` in note titles for folders. Simple conventions, no UI overhead.
- **Graph view** — see how your notes connect (`Cmd+G`).

> **Deep Dive:** For a comprehensive list of every single feature in PaperCache, check out [features.md](features.md).
> **Performance:** We take speed and battery life seriously. Check out our [Performance Audit](PERFORMANCE_AUDIT.md).

---

## Screenshots

<div align="center">
  <img src="Screenshots/editor-formatting.png" width="400" alt="Editor and Formatting">
  <img src="Screenshots/ai-demo.png" width="400" alt="Inline AI">
  <br><br>
  <img src="Screenshots/knowledge-management.png" width="400" alt="Knowledge Management">
  <img src="Screenshots/search.png" width="400" alt="Search">
  <br><br>
  <img src="Screenshots/graph-view.png" width="400" alt="Graph View">
</div>

---

## Install

**Homebrew (macOS):**

```bash
brew tap variablethe/tap
brew install --cask papercache
```

**Direct download:** grab the latest `.app` or `.exe` from [Releases](https://github.com/VariableThe/PaperCache/releases).

> If macOS blocks the app, run: `xattr -cr /Applications/PaperCache.app`

---

## Build from source

```bash
git clone https://github.com/VariableThe/PaperCache.git
cd PaperCache
npm install
npm run dev
```

Built with Electron, React, TypeScript, and Vite.

---

## Shortcuts

| Shortcut      | Action                                   |
| ------------- | ---------------------------------------- |
| `Cmd+Shift+C` | Toggle visibility (global, configurable) |
| `Cmd+Shift+N` | New note (global, configurable)          |
| `Cmd+Shift+S` | Open settings panel                      |
| `Cmd+N`       | New note (in-app)                        |
| `Cmd+T`       | Open Tasks page                          |
| `Cmd+K`       | Main action menu                         |
| `Cmd+P`       | Search notes                             |
| `Cmd+G`       | Graph view                               |
| `Cmd+H`       | Highlight selected text                  |
| `Cmd+E`       | Export note                              |
| `Cmd+Click`   | Follow internal link                     |
| `Cmd + / -`   | Zoom in / out                            |
| `Cmd + 0`     | Reset zoom                               |
| `Esc`         | Close menus or modals                    |

---

## AI setup

PaperCache brings AI right into your note — no subscription, no middleman. You can configure your API key, model, and endpoint in Settings (`Cmd+Shift+S`).

- **OpenAI:** Works out-of-the-box with your OpenAI API key and models like `gpt-4o`.
- **Free Models (OpenRouter):** Don't have an AI subscription? Get a free key at [OpenRouter](https://openrouter.ai/keys), set your Base URL to `https://openrouter.ai/api/v1`, and try a powerful free model like `nvidia/nemotron-3-super-120b-a12b:free`.
- **Local LLMs:** Works seamlessly with local models like Ollama by pointing the Base URL to your local instance.

---

## License

MIT License.
