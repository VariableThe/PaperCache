# PaperCache Desktop — Complete Feature Inventory

Compiled from `features.md`, `README.md`, `llms.txt`, and verified against source
(`src/`, `src-tauri/`). Used as the parity checklist for the Android app.

## Legend
- **Desktop-only** — tied to OS/window chrome, not applicable on Android.
- **Mobile-applicable** — should eventually exist on Android.

## 1. Editor & formatting

| # | Feature | Detail | Android status |
|---|---|---|---|
| 1 | Full Markdown rendering | inline; hides formatting chars when cursor not on them | pending |
| 2 | Custom highlight | `==text==` / `Cmd+H` | pending |
| 3 | Fenced code blocks | syntax highlighting + one-click "copy code" | pending |
| 4 | Hex color recognition | `#D97757` → color pill; click copies hex | pending |
| 5 | Date/time highlighting | `DD-MM-YYYY`, `HH:MM` → pills | pending |
| 6 | Slash-command autosuggest | `/` → ghost text; `Tab` completes | pending |
| 7 | Interactive checkboxes | `/check` ↔ `/checked`; strikethrough (rose `#ff6b81`) | pending |
| 8 | Tasks & reminders | `/task @ 1d2h`; Tasks view; overdue red; native notifications | pending |
| 9 | Countdown timers | `/timer`; presets + custom; native notifications | pending |
| 10 | Custom theming/fonts | fonts, colors, bg image, per-highlight colors, dark mode | partial (Paper Light only) |

## 2. Math, variables, calculations

| # | Feature | Detail | Android status |
|---|---|---|---|
| 11 | Reactive math | `2+2=` → `4` | pending |
| 12 | Local variables | `/var x = 10` | pending |
| 13 | Global variables | `/globvar` (cross-note) | pending |
| 14 | Auto re-evaluation | dependent equations update | pending |

## 3. Knowledge management & linking

| # | Feature | Detail | Android status |
|---|---|---|---|
| 15 | Note folders | `/` in title → folder | pending |
| 16 | Internal linking | `[text](/file Note.md)`, `/file Note.md` | pending |
| 17 | Graph view | `Cmd+G`, 2D, clustering, fuzzy search, drag | pending |
| 18 | Global search | `Cmd+P`, fuzzy | done (basic substring) |
| 19 | **Tags** | inline `!tagname` (blue pills `#3b82f6`); search filters; right-click bulk actions | **fixing now** |
| 20 | Auto-rename | timestamp id; title from first line | partial (rename only) |

## 4. AI

| # | Feature | Detail | Android status |
|---|---|---|---|
| 21 | Inline AI | `/ai <prompt>` | pending |
| 22 | Context injection | `/ctx <prompt>` | pending |
| 23 | Configurable models/endpoints | key, model, base URL, prompt | pending |
| 24 | Free defaults | OpenRouter free models | pending |
| 25 | Secure key storage | OS keychain | pending |

## 5. Desktop system integration (desktop-only)

| # | Feature | Detail |
|---|---|---|
| 26 | Stealth/background mode | hide on blur; no dock icon |
| 27 | Multi-monitor | summon on active screen |
| 28 | System tray icon | light/dark adaptive |
| 29 | Global hotkeys | 11 customizable shortcuts |
| 30 | State memory | window position/size/zoom |
| 31 | Fluid settings | inherits notepad geometry |
| 32 | Launch on startup | OS login item |
| 33 | Export note | `.md` to filesystem |
| 34 | Smart onboarding | `Welcome.md` + version notes |
| 35 | Auto-updates | silent check + restart toast |
| 36 | About & bug reports | version, Ko-fi, GitHub issue |
| 37 | Safe tutorials | `commands/` folder |
| 38 | Graph node positions | persist across sessions |

## 6. Data model & sync (new in this branch)

| # | Feature | Detail |
|---|---|---|
| 39 | Plaintext Markdown store | `~/.papercache`, relative path as id |
| 40 | Stable note_id + sync | UUID, revision ancestry, tombstones (new) |
| 41 | Assets | `/.images/`, `/.audio/` (spec'd, not implemented) |

## Key aesthetic constants (Paper Light)

- Background `#fdfdfd`, text `#2c2c2c`, muted `#6b6375`, border `#e5e4e7`
- Accent purple `#aa3bff` (variables/buttons)
- **Rose/pink `#ff6b81`** (checkboxes, tasks, checked lines)
- Tags/links blue `#3b82f6`; symbols mauve `#c586c0`; numbers `#8ab4f8`; dates amber `#f59e0b`
- Font: **JetBrains Mono**; rounded corners 4–12 px (container 12 px)
