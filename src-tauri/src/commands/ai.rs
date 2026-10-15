use keyring::Entry;
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde_json::json;

const SERVICE_NAME: &str = "com.variablethe.papercache";
const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";

#[tauri::command]
pub async fn openai_chat(
    model: String,
    messages: Vec<serde_json::Value>,
    base_url: String,
) -> Result<serde_json::Value, String> {
    if model.trim().is_empty() {
        return Err("Invalid model provided".into());
    }
    if messages.is_empty() {
        return Err("Messages must be a non-empty array".into());
    }

    let entry = Entry::new(SERVICE_NAME, "openai_api_key")
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    let api_key = entry
        .get_password()
        .map_err(|_| "API key not found. Please set it in settings.".to_string())?;

    let client = Client::new();

    let mut base = if base_url.is_empty() {
        DEFAULT_BASE_URL.to_string()
    } else {
        base_url.trim_end_matches('/').to_string()
    };
    if !base.ends_with("/chat/completions") {
        base.push_str("/chat/completions");
    }

    let payload = json!({
        "model": model,
        "messages": messages
    });

    let response = client
        .post(&base)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://github.com/papercache/papercache")
        .header("X-Title", "PaperCache")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "API request failed with status {}: {}",
            status, error_text
        ));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))
}

#[tauri::command]
pub async fn openai_transcribe(
    file_path: String,
    base_url: String,
) -> Result<String, String> {
    if file_path.trim().is_empty() {
        return Err("Invalid file path provided".into());
    }

    let entry = Entry::new(SERVICE_NAME, "openai_api_key")
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    let api_key = entry
        .get_password()
        .map_err(|_| "API key not found. Please set it in settings.".to_string())?;

    let resolved_path = if std::path::Path::new(&file_path).exists() {
        std::path::PathBuf::from(&file_path)
    } else {
        let clean = file_path.trim_start_matches('/');
        crate::commands::fs::get_papercache_dir()
            .map_err(|e| format!("Failed to get app directory: {}", e))?
            .join(clean)
    };

    let file_bytes = tokio::fs::read(&resolved_path)
        .await
        .map_err(|e| format!("Failed to read audio file ({}): {}", resolved_path.display(), e))?;

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.webm")
        .to_string();

    let client = Client::new();

    let mut base = if base_url.is_empty()
        || base_url.contains("openrouter.ai")
        || base_url.contains("googleapis.com")
        || base_url.contains("anthropic.com")
    {
        DEFAULT_BASE_URL.to_string()
    } else {
        base_url.trim_end_matches('/').to_string()
    };
    if !base.ends_with("/audio/transcriptions") {
        base.push_str("/audio/transcriptions");
    }

    let part = Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("application/octet-stream")
        .map_err(|e| format!("Failed to create multipart part: {}", e))?;

    let form = Form::new()
        .part("file", part)
        .text("model", "whisper-1");

    let response = client
        .post(&base)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "Transcription API request failed with status {}: {}",
            status, error_text
        ));
    }

    let res_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse transcription API response: {}", e))?;

    if let Some(text) = res_json.get("text").and_then(|t| t.as_str()) {
        Ok(text.to_string())
    } else {
        Err("No transcript returned from API".to_string())
    }
}

