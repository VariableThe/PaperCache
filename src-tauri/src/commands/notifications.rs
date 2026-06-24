use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration};

#[derive(serde::Deserialize, Debug, Clone)]
pub struct ReminderPayload {
    pub key: String,
    pub label: String,
    #[serde(rename = "dueAt")]
    pub due_at: i64, // Unix timestamp in milliseconds
}

#[derive(Default)]
pub struct NotificationState {
    pub reminder_handles: Arc<RwLock<HashMap<String, JoinHandle<()>>>>,
    pub timer_handles: Arc<RwLock<HashMap<String, JoinHandle<()>>>>,
}

#[tauri::command]
pub async fn schedule_reminders(
    app: AppHandle,
    reminders: Vec<ReminderPayload>,
    state: tauri::State<'_, NotificationState>,
) -> Result<(), String> {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let mut new_handles: HashMap<String, JoinHandle<()>> = HashMap::new();

    for reminder in reminders {
        let delay_ms = reminder.due_at - now_ms;
        if delay_ms < 0 {
            continue;
        }

        let app_clone = app.clone();
        let label = reminder.label.clone();
        let key = reminder.key.clone();

        let handle = tokio::spawn(async move {
            sleep(Duration::from_millis(delay_ms as u64)).await;
            let _ = app_clone
                .notification()
                .builder()
                .title("PaperCache Reminder")
                .body(&label)
                .show();
            let _ = app_clone.emit("reminder-fired", &key);
        });

        if let Some(old) = new_handles.insert(reminder.key, handle) {
            old.abort();
        }
    }

    {
        let mut handles = state
            .reminder_handles
            .write()
            .map_err(|e| e.to_string())?;
        for (_, handle) in handles.drain() {
            handle.abort();
        }
        handles.extend(new_handles);
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_all_reminders(
    state: tauri::State<'_, NotificationState>,
) -> Result<(), String> {
    let mut handles = state
        .reminder_handles
        .write()
        .map_err(|e| e.to_string())?;
    for (_, handle) in handles.drain() {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn schedule_timer(
    app: AppHandle,
    id: String,
    duration_ms: u64,
    label: String,
    state: tauri::State<'_, NotificationState>,
) -> Result<(), String> {
    let app_clone = app.clone();
    let id_clone = id.clone();

    let handle = tokio::spawn(async move {
        sleep(Duration::from_millis(duration_ms)).await;
        let _ = app_clone
            .notification()
            .builder()
            .title("PaperCache Timer")
            .body(&format!("⏱ Timer finished: {}", label))
            .show();
        let _ = app_clone.emit("timer-complete", &id_clone);
    });

    {
        let mut handles = state
            .timer_handles
            .write()
            .map_err(|e| e.to_string())?;
        if let Some(existing) = handles.remove(&id) {
            existing.abort();
        }
        handles.insert(id, handle);
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_timer(
    id: String,
    state: tauri::State<'_, NotificationState>,
) -> Result<(), String> {
    let mut handles = state
        .timer_handles
        .write()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = handles.remove(&id) {
        handle.abort();
    }
    Ok(())
}
