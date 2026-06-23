use tauri::AppHandle;
use tauri::Manager;

pub fn show_and_focus_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "macos")]
        crate::macos::force_focus();
    }
}
