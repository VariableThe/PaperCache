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

pub fn run_onboarding(app: &AppHandle) {
    let is_hyprland = std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok() || std::env::var("HYPRLAND_CMD").is_ok();
    let mod_key = if is_hyprland { "Alt" } else { "Command/Ctrl" };

    if let Ok(base) = get_papercache_dir() {
        let welcome_path = base.join("Welcome.md");
        
        let welcome_content = format!(
            "# Welcome to PaperCache\n\nThis is your first note. Here's what you can do:\n\n\
            - **New note** — Press {} + N (or {} + Shift + N from anywhere)\n\
            - **Search notes** — Press {} + P\n\
            - **Graph view** — Press {} + G to see how your notes connect\n\
            - **Tasks & timers** — Press {} + T\n\
            - **Shortcuts** — Press {} + / for the full list\n\
            - **Slash commands** — Type `/` in the editor for AI, checkboxes, tasks, variables, and more\n\
            - **Settings** — Press {} + Shift + S\n\n\
            Start typing to edit this note, or create a new one!",
            mod_key, mod_key, mod_key, mod_key, mod_key, mod_key, mod_key
        );

        if !welcome_path.exists() {
            let _ = fs::write(&welcome_path, &welcome_content);
        } else {
            // Force update if the file contains the old generic shortcut text
            if let Ok(content) = fs::read_to_string(&welcome_path) {
                if content.contains("use shortcuts to create a new one!") || content.contains("Command/Ctrl + Shift + N") || content.contains("Alt + Shift + N") {
                    let _ = fs::write(&welcome_path, &welcome_content);
                }
            }
        }

        let commands_dir = base.join("commands");
        if !commands_dir.exists() {
            let _ = fs::create_dir_all(&commands_dir);
            let summarize_path = commands_dir.join("summarize.md");
            if !summarize_path.exists() {
                let _ = fs::write(
                    &summarize_path,
                    "# Summarize\n\nPlease summarize the selected text into 3 bullet points.",
                );
            }
            let translate_path = commands_dir.join("translate.md");
            if !translate_path.exists() {
                let _ = fs::write(
                    &translate_path,
                    "# Translate\n\nPlease translate the following text into English.",
                );
            }
        }

        let version = app.package_info().version.to_string();
        let note_filename = format!("New Features in v{}.md", version);
        let note_target_path = base.join(&note_filename);
        
        if !note_target_path.exists() {
            // First, delete any old "New Features in vX.Y.Z.md" notes
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

            // Now copy the new note if it exists in bundled resources
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
