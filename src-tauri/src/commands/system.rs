use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

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
pub fn quit_app(app: AppHandle) {
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
pub fn set_launch_at_startup(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;

    // We handle the update automatically if one is available
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        // Here we could emit an event to the frontend or just download and install it
        let _ = update.download_and_install(|_, _| {}, || {}).await;
        app.restart();
    }
    Ok(())
}
