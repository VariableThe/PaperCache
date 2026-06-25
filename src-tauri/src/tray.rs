use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App,
};

pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_hide, &quit])?;

    let icon_result = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"));
    let icon = match icon_result {
        Ok(icon) => icon,
        Err(e) => {
            eprintln!("Failed to load tray icon: {}", e);
            return Ok(());
        }
    };

    TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true)
        .tooltip("PaperCache")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id == "show_hide" {
                crate::commands::system::toggle_window(app);
            } else if event.id == "quit" {
                crate::commands::system::quit_app(app.clone());
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                crate::commands::system::toggle_window(app);
            }
        })
        .build(app)?;

    Ok(())
}
