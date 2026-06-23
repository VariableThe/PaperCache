#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

mod commands;
#[cfg(target_os = "macos")]
mod macos;
mod tray;

use commands::shortcuts::GlobalShortcutState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct DialogState {
    pub is_open: Arc<AtomicBool>,
}

impl Default for DialogState {
    fn default() -> Self {
        Self {
            is_open: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GlobalShortcutState::default())
        .manage(DialogState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE,
                )
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--silently"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            commands::fs::run_onboarding();
            tray::create_tray(app).expect("Failed to create tray");

            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                crate::macos::set_move_to_active_space(&window);

                let dialog_state = app.state::<crate::DialogState>();
                let is_dialog_open = dialog_state.is_open.clone();

                window.on_window_event({
                    let w = window.clone();
                    move |event| match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = w.hide();
                        }
                        tauri::WindowEvent::Focused(focused)
                            if !focused && !is_dialog_open.load(Ordering::SeqCst) =>
                        {
                            let _ = w.hide();
                        }
                        _ => {}
                    }
                });
            } else {
                eprintln!("WARNING: 'main' window not found during setup");
            }

            #[cfg(target_os = "macos")]
            macos::hide_dock_icon();

            #[cfg(target_os = "macos")]
            macos::setup_power_monitor(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::get_notes,
            commands::fs::save_note,
            commands::fs::read_note,
            commands::fs::delete_note,
            commands::fs::rename_note,
            commands::fs::export_note,
            commands::fs::set_dialog_open,
            commands::system::close_window,
            commands::system::quit_app,
            commands::system::open_external,
            commands::system::open_file,
            commands::system::set_launch_at_startup,
            commands::system::check_for_updates,
            commands::keychain::set_api_key,
            commands::keychain::get_api_key_status,
            commands::keychain::get_api_key,
            commands::keychain::safe_storage_encrypt,
            commands::keychain::safe_storage_decrypt,
            commands::ai::openai_chat,
            commands::shortcuts::update_global_shortcut,
            commands::shortcuts::pause_shortcuts,
            commands::shortcuts::resume_shortcuts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
