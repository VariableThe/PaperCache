use tauri::{AppHandle, WebviewWindow};
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

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        app.opener().open_url(&url, None::<&str>).map_err(|e| e.to_string())?;
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
    
    app.opener().open_path(canonical.to_string_lossy().to_string(), None::<&str>).map_err(|e| e.to_string())?;
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

/*
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let _ = updater.check().await.map_err(|e| e.to_string())?;
    Ok(())
}
*/
