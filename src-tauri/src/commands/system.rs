use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[tauri::command]
pub fn close_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        window.hide().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            #[cfg(target_os = "macos")]
            crate::macos::force_focus();
        }
    }
}

#[tauri::command]
pub fn restore_window_state(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(app_dir) = app.path().app_config_dir() {
            let state_path = app_dir.join(".window-state.json");
            if let Ok(content) = std::fs::read_to_string(&state_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(main) = val.get("main") {
                        if let (Some(x), Some(y)) = (
                            main.get("x").and_then(|v| v.as_i64()),
                            main.get("y").and_then(|v| v.as_i64()),
                        ) {
                            let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                        }
                        if let (Some(w), Some(h)) = (
                            main.get("width").and_then(|v| v.as_i64()),
                            main.get("height").and_then(|v| v.as_i64()),
                        ) {
                            let _ = window.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    let _ = app.save_window_state(StateFlags::POSITION | StateFlags::SIZE);
    app.exit(0);
}

#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        app.opener()
            .open_url(&url, None::<&str>)
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Invalid URL protocol".into())
    }
}

#[tauri::command]
pub fn open_file(app: AppHandle, path: String) -> Result<(), String> {
    let base = crate::commands::fs::get_papercache_dir()?;
    let target = base.join(&path);

    // Canonicalize directly since the file must exist to be opened
    let canonical = target.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&base) {
        return Err("Path traversal detected in open_file".into());
    }

    app.opener()
        .open_path(canonical.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(())
}

use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn get_launch_at_startup(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_launch_at_startup(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize, Clone)]
struct UpdatePayload {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let _ = app.emit("update-status", UpdatePayload {
        status: "checking".into(),
        version: None,
        error: None,
    });

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            let err_str = e.to_string();
            let _ = app.emit("update-status", UpdatePayload {
                status: "error".into(),
                version: None,
                error: Some(err_str.clone()),
            });
            return Err(err_str);
        }
    };

    let update_res = updater.check().await;
    match update_res {
        Ok(Some(update)) => {
            let version = update.version.clone();
            let _ = app.emit("update-status", UpdatePayload {
                status: "available".into(),
                version: Some(version),
                error: None,
            });

            let _ = app.emit("update-status", UpdatePayload {
                status: "downloading".into(),
                version: None,
                error: None,
            });

            let app_clone = app.clone();
            tokio::spawn(async move {
                match update.download_and_install(|_, _| {}, || {}).await {
                    Ok(_) => {
                        let _ = app_clone.emit("update-status", UpdatePayload {
                            status: "ready".into(),
                            version: None,
                            error: None,
                        });
                        let _ = app_clone.emit("update-ready", ());
                    }
                    Err(e) => {
                        let _ = app_clone.emit("update-status", UpdatePayload {
                            status: "error".into(),
                            version: None,
                            error: Some(e.to_string()),
                        });
                    }
                }
            });
        }
        Ok(None) => {
            let _ = app.emit("update-status", UpdatePayload {
                status: "up-to-date".into(),
                version: None,
                error: None,
            });
        }
        Err(e) => {
            let err_str = e.to_string();
            let _ = app.emit("update-status", UpdatePayload {
                status: "error".into(),
                version: None,
                error: Some(err_str.clone()),
            });
            return Err(err_str);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

#[tauri::command]
pub fn is_hyprland() -> Result<bool, String> {
    Ok(std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok() || std::env::var("HYPRLAND_CMD").is_ok())
}
