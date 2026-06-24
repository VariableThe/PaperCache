use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub content: String,
    pub mtime: u64,
}

pub fn get_papercache_dir() -> Result<PathBuf, String> {
    let mut path = dirs::home_dir().ok_or("Could not find home directory")?;
    path.push(".papercache");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    path.canonicalize().map_err(|e| e.to_string())
}

pub fn get_safe_path(id: &str) -> Result<PathBuf, String> {
    let base = get_papercache_dir()?;
    let target = base.join(id);

    let parent = target.parent().ok_or("Invalid path parent")?;
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_parent.starts_with(&base) {
        return Err("Path traversal detected".to_string());
    }

    if target.exists() {
        let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
        if !canonical_target.starts_with(&base) {
            return Err("Path traversal detected".to_string());
        }
        Ok(canonical_target)
    } else {
        let file_name = target.file_name().ok_or("Invalid file name")?;
        Ok(canonical_parent.join(file_name))
    }
}

fn walk_dir(dir: &Path, notes: &mut Vec<Note>, base_path: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            walk_dir(&path, notes, base_path)?;
        } else if path.is_file() {
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if file_name == "window-state.json" || file_name == ".window-state" {
                continue;
            }
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "md" || ext == "json" {
                let content = fs::read_to_string(&path)
                    .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
                
                let metadata = fs::metadata(&path).ok();
                let mtime = metadata
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or_default();
                    
                let id = path
                    .strip_prefix(base_path)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                notes.push(Note { id, content, mtime });
            }
        }
    }
    Ok(())
}

fn clean_empty_parents(file_path: &Path, base: &Path) {
    let mut current = file_path.parent();
    while let Some(parent) = current {
        if parent == base || !parent.starts_with(base) {
            break;
        }
        if fs::read_dir(parent)
            .map(|mut i| i.next().is_none())
            .unwrap_or(false)
        {
            if fs::remove_dir(parent).is_err() {
                break;
            }
            current = parent.parent();
        } else {
            break;
        }
    }
}

#[tauri::command]
pub fn get_notes() -> Result<Vec<Note>, String> {
    let base = get_papercache_dir()?;
    let mut notes = Vec::new();
    walk_dir(&base, &mut notes, &base)?;
    Ok(notes)
}

#[tauri::command]
pub fn save_note(id: String, content: String) -> Result<bool, String> {
    let path = get_safe_path(&id)?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn read_note(id: String) -> Result<String, String> {
    let path = get_safe_path(&id)?;
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(id: String) -> Result<bool, String> {
    if id.starts_with("commands/") {
        return Err("Cannot delete protected command files".into());
    }
    let path = get_safe_path(&id)?;
    fs::remove_file(&path).map_err(|e| e.to_string())?;

    if let Ok(base) = get_papercache_dir() {
        clean_empty_parents(&path, &base);
    }

    Ok(true)
}

#[tauri::command]
pub fn rename_note(old_id: String, new_id: String) -> Result<bool, String> {
    let old_path = get_safe_path(&old_id)?;
    let new_path = get_safe_path(&new_id)?;
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    if let Ok(base) = get_papercache_dir() {
        clean_empty_parents(&old_path, &base);
    }

    Ok(true)
}

#[tauri::command]
pub async fn export_note(
    app: AppHandle,
    state: tauri::State<'_, crate::DialogState>,
    filename: String,
    content: String,
) -> Result<bool, String> {
    use std::sync::atomic::Ordering;
    state.is_open.store(true, Ordering::SeqCst);

    let state_clone = state.is_open.clone();
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_file_name(&filename)
        .save_file(move |file_path| {
            state_clone.store(false, Ordering::SeqCst);
            let res = if let Some(path) = file_path {
                let sys_path = path
                    .into_path()
                    .map_err(|_| "Invalid path from dialog".to_string());
                match sys_path {
                    Ok(p) => fs::write(p, content)
                        .map(|_| true)
                        .map_err(|e| e.to_string()),
                    Err(e) => Err(e),
                }
            } else {
                Ok(false)
            };
            let _ = tx.send(res);
        });

    rx.await.unwrap_or_else(|_| {
        state.is_open.store(false, Ordering::SeqCst);
        Err("Dialog was closed unexpectedly".to_string())
    })
}

#[tauri::command]
pub fn set_dialog_open(state: tauri::State<'_, crate::DialogState>, open: bool) {
    use std::sync::atomic::Ordering;
    state.is_open.store(open, Ordering::SeqCst);
}

fn write_onboarding_file(base: &Path, rel_path: &str, content: &str, _is_new_version: bool) {
    let path = base.join(rel_path);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    // Only write if file doesn't exist — preserve user edits across version changes
    if !path.exists() {
        let _ = fs::write(&path, content);
    }
}

#[tauri::command]
pub fn remove_onboarding_files() -> Result<(), String> {
    if let Ok(base) = get_papercache_dir() {
        // Only remove generated onboarding content — preserve Welcome.md and commands/
        let onboarding_dir = base.join("onboarding");
        let _ = fs::remove_dir_all(&onboarding_dir);

        let marker = base.join(".onboarding_version");
        let _ = fs::remove_file(&marker);
    }
    Ok(())
}

pub fn run_onboarding(app: &AppHandle) {
    let is_hyprland = std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok() || std::env::var("HYPRLAND_CMD").is_ok();
    let mod_key = if is_hyprland { "Alt" } else { "Command/Ctrl" };

    if let Ok(base) = get_papercache_dir() {
        let version = app.package_info().version.to_string();
        let version_marker = base.join(".onboarding_version");
        let last_version = fs::read_to_string(&version_marker).ok();
        let is_new_version = last_version.as_deref() != Some(&version);

        if is_new_version {
            let _ = fs::write(&version_marker, &version);
        }

        let mk = mod_key;

        write_onboarding_file(&base, "Welcome.md", &format!(
            "# Welcome to PaperCache\n\n\
            This is your first note. Start typing to edit it, or use **{0} + N** to create a new one. \
            PaperCache is a markdown-based knowledge manager with AI, graph visualization, tasks, timers, and more.\n\n\
            ## Quick Start\n\n\
            - **New note** — Press {0} + N (or {0} + Shift + N from anywhere)\n\
            - **Search notes** — Press {0} + P\n\
            - **Graph view** — Press {0} + G\n\
            - **Tasks & timers** — Press {0} + T\n\
            - **Settings** — Press {0} + Shift + S\n\n\
            ## Explore by Topic\n\n\
            - [Editor Features](/file onboarding/Editor.md) — Markdown, highlights, tags, pills, math, variables\n\
            - [Slash Commands](/file onboarding/Commands.md) — AI, tasks, checkboxes, timers, variables\n\
            - [Keyboard Shortcuts](/file Shortcuts.md) — Complete reference\n\
            - [Graph View](/file onboarding/Graph.md) — Knowledge graph visualization\n\
            - [AI Features](/file onboarding/AI.md) — Configuration and usage\n\
            - [Tasks & Timers](/file onboarding/Tasks.md) — Task management and countdowns\n\
            - [Customization & System](/file onboarding/Customization.md) — Themes, settings, system features\n\n\
            Press **{0} + Click** on any link above to jump to that note. \
            Or start typing to edit this one!",
            mk
        ), is_new_version);

        write_onboarding_file(&base, "onboarding/Editor.md", &format!(
            "# Editor Features\n\n\
            PaperCache uses a full-featured markdown editor with these capabilities:\n\n\
            ## Markdown\n\n\
            Headings (H1-H6), bold, italic, strikethrough, lists, horizontal rules (`---`), \
            and fenced code blocks with language labels and one-click copy.\n\n\
            ## Highlights\n\n\
            Select text and press **{0} + H** to wrap it in `==text==` which renders as a visual highlight.\n\n\
            ## Tags\n\n\
            Type `!tagname` anywhere in your note. Tags appear as clickable pills \
            in the search view — right-click for bulk delete or export.\n\n\
            ## Color Pills\n\n\
            Hex colors like `#D97757` auto-render as a colored swatch. Click the circle to copy the hex code.\n\n\
            ## Date & Time Pills\n\n\
            `DD-MM-YYYY` and `HH:MM` formats auto-highlight for easy scanning.\n\n\
            ## Currency Pills\n\n\
            `$100`, `€50`, `£20`, `¥1000`, `₹500` auto-detect.\n\n\
            ## Reactive Math\n\n\
            Type an equation ending with `=` like `2+2=` and the result appears instantly. \
            Supports any arithmetic expression via `expr-eval`.\n\n\
            ## Variables\n\n\
            - `/var name = value` defines a note-scoped variable. Refer to it elsewhere and it auto-updates.\n\
            - `/globvar name = value` defines a cross-note global variable visible in all notes.\n\
            - Changing any variable re-evaluates all dependent math expressions.\n\n\
            ## Note Management\n\n\
            - **Auto-title** — The first `# Header` in a note becomes its display title\n\
            - **Rename** — Click the title bar to rename; changes the file ID\n\
            - **Internal links** — `[text](/file NoteTitle.md)` — {0} + Click to jump\n\
            - **External links** — `[text](url)` — {0} + Click to open in browser\n\
            - **Folders** — Use `/` in note names (e.g. `projects/my-note.md`) for nested folders with distinct colors\n\
            - **Delete** — {0} + Backspace with confirmation\n\n\
            ---\n\
            ↑ [Welcome](/file Welcome.md) → [Slash Commands](/file onboarding/Commands.md)",
            mk
        ), is_new_version);

        write_onboarding_file(&base, "onboarding/Commands.md",
            "# Slash Commands\n\n\
            Type `/` in the editor to trigger autocomplete, then press Tab to accept. \
            Press Enter to execute.\n\n\
            ## Available Commands\n\n\
            - `/ai <prompt>` — Inline AI completion. Makes an API call and inserts the response.\n\
            - `/ctx <prompt>` — AI with full note context (up to 50,000 chars). Same as `/context`.\n\
            - `/context <prompt>` — Alias for `/ctx`.\n\
            - `/task <label> @ <due>` — Creates a task with optional due date. Due formats: `@ 1d2h`, `@ tmrw`, or `DD-MM-YYYY HH:MM`.\n\
            - `/check` — Creates an interactive checkbox. Click to toggle.\n\
            - `/timer` — Opens the countdown timer panel.\n\
            - `/var name = value` — Defines a note-scoped variable.\n\
            - `/globvar name = value` — Defines a cross-note global variable.\n\n\
            ## Tutorial Command Files\n\n\
            The `commands/` folder contains template files used by some slash commands:\n\
            - [summarize.md](/file commands/summarize.md) — Summarization prompt template\n\
            - [translate.md](/file commands/translate.md) — Translation prompt template\n\n\
            These are safe to edit if you want to customize the prompts.\n\n\
            ---\n\
            ← [Editor Features](/file onboarding/Editor.md) ↑ [Welcome](/file Welcome.md) → [Graph View](/file onboarding/Graph.md)"
        , is_new_version);

        write_onboarding_file(&base, "onboarding/Graph.md", &format!(
            "# Graph View\n\n\
            Press **{0} + G** to open the interactive 3D knowledge graph.\n\n\
            ## Features\n\n\
            - Every note is a flat circle node; internal links become edges between nodes\n\
            - Nodes cluster by folder with distinct HSL colors\n\
            - Drag nodes to rearrange — positions persist across sessions\n\
            - Press **{0} + F** inside the graph for fuzzy search — arrow keys to navigate, Enter to fly to the matched node\n\
            - Scroll to zoom, drag to pan (rotation is locked)\n\
            - Nodes physically occlude edges passing through them\n\
            - All labels are always visible (no hover required)\n\n\
            ---\n\
            ← [Slash Commands](/file onboarding/Commands.md) ↑ [Welcome](/file Welcome.md) → [AI Features](/file onboarding/AI.md)",
            mk
        ), is_new_version);

        write_onboarding_file(&base, "onboarding/AI.md", &format!(
            "# AI Features\n\n\
            PaperCache integrates with OpenAI-compatible APIs for inline AI assistance.\n\n\
            ## Configuration\n\n\
            Open **Settings ({0} + Shift + S)** to configure:\n\
            - **API Base URL** — Defaults to OpenRouter's free tier\n\
            - **Model** — Default: `nvidia/nemotron-3-super-120b-a12b:free`\n\
            - **API Key** — Stored securely via OS keychain\n\
            - **System Prompt** — Custom instructions sent with every AI request\n\n\
            ## Usage\n\n\
            - `/ai <prompt>` — Inline completion. Type your prompt and press Enter.\n\
            - `/ctx <prompt>` — Same, but includes the entire current note as context.\n\n\
            ## Providers\n\n\
            Works with OpenAI, OpenRouter, Ollama, or any OpenAI-compatible endpoint.\n\n\
            ---\n\
            ← [Graph View](/file onboarding/Graph.md) ↑ [Welcome](/file Welcome.md) → [Tasks & Timers](/file onboarding/Tasks.md)",
            mk
        ), is_new_version);

        write_onboarding_file(&base, "onboarding/Tasks.md", &format!(
            "# Tasks & Timers\n\n\
            ## Tasks\n\n\
            Create a task by typing `/task Buy groceries @ tmrw` anywhere in a note.\n\n\
            - Due date formats: `@ 1d2h` (relative), `@ tmrw`, or `DD-MM-YYYY HH:MM`\n\
            - Tasks with due dates fire native OS notifications at the right time\n\
            - Press **{0} + T** to open the unified tasks view\n\
            - Overdue tasks appear in red, imminent ones in orange\n\
            - Click the circle to toggle complete\n\n\
            ## Timers\n\n\
            - Type `/timer` or use the action menu ({0} + K) to open the timer panel\n\
            - Quick presets: 5min, 10min, 25min, 1hr — or set custom hours/minutes/seconds\n\
            - Live countdown with progress bar\n\
            - Native OS notification + in-app toast on completion\n\
            - Timer runs on the Rust backend so it fires even when minimized\n\n\
            ---\n\
            ← [AI Features](/file onboarding/AI.md) ↑ [Welcome](/file Welcome.md) → [Customization & System](/file onboarding/Customization.md)",
            mk
        ), is_new_version);

        write_onboarding_file(&base, "onboarding/Customization.md", &format!(
            "# Customization & System\n\n\
            ## Themes\n\n\
            Three built-in presets: `paper-light`, `grid-dark`, `blueprint`. \
            Switch in Settings ({0} + Shift + S).\n\n\
            ## Fonts\n\n\
            JetBrains Mono (default), Monospace, Sans-serif, System Default, or Serif.\n\n\
            ## Background\n\n\
            Preset theme, solid color (pick any color), or custom image URL.\n\n\
            ## Colors\n\n\
            Individually customize: main text, numbers, math symbols, math results, and AI response colors.\n\n\
            ## Shortcut Recording\n\n\
            Record custom global shortcuts in Settings. \
            To avoid conflicts, global shortcuts are paused during recording.\n\n\
            ## System Features\n\n\
            - **Background mode** — No dock icon on macOS; hotkey toggles window\n\
            - **Auto-hide** — Window hides on focus loss (200ms debounce on Windows/Linux)\n\
            - **Multi-monitor** — Opens on the monitor under your cursor\n\
            - **Launch on startup** — Optional toggle in Settings\n\
            - **Auto-updates** — Silent background check on startup; manual check in Settings\n\
            - **Export** — {0} + E saves any note as `.md`; right-click a tag for bulk export of all tagged notes\n\
            - **State persistence** — Window position, size, zoom, and last-opened note are all remembered\n\n\
            ---\n\
            ← [Tasks & Timers](/file onboarding/Tasks.md) ↑ [Welcome](/file Welcome.md)",
            mk
        ), is_new_version);

        let commands_dir = base.join("commands");
        if !commands_dir.exists() || is_new_version {
            if !commands_dir.exists() {
                let _ = fs::create_dir_all(&commands_dir);
            }
            for (name, body) in [
                ("summarize.md", "# Summarize\n\nPlease summarize the selected text into 3 bullet points."),
                ("translate.md", "# Translate\n\nPlease translate the following text into English."),
            ] {
                let path = commands_dir.join(name);
                if !path.exists() || is_new_version {
                    let _ = fs::write(&path, body);
                }
            }
        }

        let note_filename = format!("New Features in v{}.md", version);
        let note_target_path = base.join(&note_filename);

        if !note_target_path.exists() {
            if let Ok(entries) = fs::read_dir(&base) {
                for entry in entries.filter_map(Result::ok) {
                    let path = entry.path();
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with("New Features in v") && name.ends_with(".md") && name != note_filename.as_str() {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }

            if let Ok(resource_dir) = app.path().resource_dir() {
                let bundled_note = resource_dir.join("notes").join(&note_filename);
                let bundled_note_up = resource_dir.join("_up_").join("notes").join(&note_filename);
                if bundled_note.exists() {
                    let _ = fs::copy(&bundled_note, &note_target_path);
                } else if bundled_note_up.exists() {
                    let _ = fs::copy(&bundled_note_up, &note_target_path);
                }
            }
        }
    }
}
