use keyring::Entry;
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
