use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub struct GlobalShortcutState {
    pub shortcuts: Mutex<HashMap<String, String>>,
}

impl Default for GlobalShortcutState {
    fn default() -> Self {
        Self {
            shortcuts: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn update_global_shortcut(
    app: AppHandle,
    action: String,
    old_shortcut: String,
    new_shortcut: String,
) -> Result<(), String> {
    // Unregister old
    if !old_shortcut.is_empty() {
        if let Ok(shortcut) = old_shortcut.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }

    // Register new
    if !new_shortcut.is_empty() {
        let shortcut = new_shortcut
            .parse::<Shortcut>()
            .map_err(|e| format!("Invalid shortcut: {}", e))?;

        let action_clone = action.clone();
        app.global_shortcut()
            .on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        if is_visible {
                            let _ = window.hide();
                        } else {
                            crate::window_utils::show_and_focus_window(app);
                        }
                    }
                    let _ = app.emit(&format!("trigger-{}", action_clone), ());
                }
            })
            .map_err(|e| format!("Failed to register shortcut: {}", e))?;
    }

    // Update state
    let state = app.state::<GlobalShortcutState>();
    let mut map = state.shortcuts.lock().unwrap();
    map.insert(action, new_shortcut);

    Ok(())
}

#[tauri::command]
pub fn pause_shortcuts(app: AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resume_shortcuts(app: AppHandle) -> Result<(), String> {
    let state = app.state::<GlobalShortcutState>();
    let map = state.shortcuts.lock().unwrap();

    for (action, shortcut_str) in map.iter() {
        if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
            let action_clone = action.clone();
            let _ = app
                .global_shortcut()
                .on_shortcut(shortcut, move |app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                crate::window_utils::show_and_focus_window(app);
                            }
                        }
                        let _ = app.emit(&format!("trigger-{}", action_clone), ());
                    }
                });
        }
    }
    Ok(())
}
