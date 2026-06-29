#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

mod commands;
#[cfg(target_os = "macos")]
mod macos;
mod tray;

#[allow(dead_code)]
const FOCUS_LOSS_DEBOUNCE_MS: u64 = 200;
#[allow(dead_code)]
const WINDOW_STATE_RESTORE_DELAY_MS: u64 = 300;


use commands::shortcuts::GlobalShortcutState;
use commands::notifications::NotificationState;
#[cfg(not(target_os = "macos"))]
use std::sync::atomic::AtomicU64;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri_plugin_window_state::{StateFlags, WindowExt};

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
        .manage(NotificationState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
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
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            Some(vec!["--silently"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            commands::fs::run_onboarding(app.handle());
            tray::create_tray(app).expect("Failed to create tray");

            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let dialog_state = app.state::<crate::DialogState>();
                let is_dialog_open = dialog_state.is_open.clone();
                #[cfg(not(target_os = "macos"))]
                let focus_gen = Arc::new(AtomicU64::new(0));

                window.on_window_event({
                    let w = window.clone();
                    #[cfg(not(target_os = "macos"))]
                    let gen = focus_gen.clone();
                    move |event| match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = w.hide();
                        }
                        tauri::WindowEvent::Focused(focused) => {
                            if *focused {
                                #[cfg(not(target_os = "macos"))]
                                { gen.fetch_add(1, Ordering::SeqCst); }
                            } else if !is_dialog_open.load(Ordering::SeqCst) {
                                #[cfg(target_os = "macos")]
                                let _ = w.hide();

                                #[cfg(not(target_os = "macos"))]
                                {
                                    let gen_at_spawn = gen.fetch_add(1, Ordering::SeqCst) + 1;
                                    let w2 = w.clone();
                                    let g2 = gen.clone();
                                    let dialog_open = is_dialog_open.clone();
                                    std::thread::spawn(move || {
                                        std::thread::sleep(
                                            std::time::Duration::from_millis(FOCUS_LOSS_DEBOUNCE_MS),
                                        );
                                        if g2.load(Ordering::SeqCst) == gen_at_spawn
                                            && !dialog_open.load(Ordering::SeqCst)
                                        {
                                            let _ = w2.hide();
                                        }
                                    });
                                }
                            }
                        }
                        _ => {}
                    }
                });

                #[cfg(target_os = "macos")]
                crate::macos::set_move_to_active_space(&window);

                // Restore window state after event loop is running and display server is ready.
                // Plugin's on_window_ready fires too early for available_monitors() on macOS.
                let win = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(WINDOW_STATE_RESTORE_DELAY_MS));
                    let _ = win.clone().run_on_main_thread(move || {
                        let _ = win.restore_state(StateFlags::POSITION | StateFlags::SIZE);
                        if let Ok(app_dir) = win.app_handle().path().app_config_dir() {
                            let state_path = app_dir.join(".window-state.json");
                            if let Ok(content) = std::fs::read_to_string(&state_path) {
                                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                    if let Some(main) = val.get("main") {
                                        if let (Some(x), Some(y)) = (
                                            main.get("x").and_then(|v| v.as_i64()),
                                            main.get("y").and_then(|v| v.as_i64()),
                                        ) {
                                            let _ = win.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                                        }
                                        if let (Some(w), Some(h)) = (
                                            main.get("width").and_then(|v| v.as_i64()),
                                            main.get("height").and_then(|v| v.as_i64()),
                                        ) {
                                            let _ = win.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
                                        }
                                    }
                                }
                            }
                        }
                    });
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
            commands::fs::remove_onboarding_files,
            commands::system::close_window,
            commands::system::restore_window_state,
            commands::system::quit_app,
            commands::system::open_external,
            commands::system::open_file,
            commands::system::get_launch_at_startup,
            commands::system::set_launch_at_startup,
            commands::system::check_for_updates,
            commands::system::is_hyprland,
            commands::keychain::set_api_key,
            commands::keychain::get_api_key_status,
            commands::keychain::get_api_key,
            commands::keychain::safe_storage_encrypt,
            commands::keychain::safe_storage_decrypt,
            commands::ai::openai_chat,
            commands::shortcuts::update_global_shortcut,
            commands::shortcuts::pause_shortcuts,
            commands::shortcuts::resume_shortcuts,
            commands::notifications::schedule_reminders,
            commands::notifications::cancel_all_reminders,
            commands::notifications::schedule_timer,
            commands::notifications::cancel_timer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
