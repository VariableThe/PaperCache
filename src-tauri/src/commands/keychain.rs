use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use rand::RngCore;

const SERVICE_NAME: &str = "com.variablethe.papercache";

#[tauri::command]
pub fn set_api_key(key: String) -> Result<bool, String> {
    let entry = Entry::new(SERVICE_NAME, "openai_api_key")
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    if key.is_empty() {
        entry.delete_credential().ok();
        return Ok(true);
    }
    entry
        .set_password(&key)
        .map_err(|e| format!("Failed to set API key: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub fn get_api_key_status() -> bool {
    if let Ok(entry) = Entry::new(SERVICE_NAME, "openai_api_key") {
        entry.get_password().is_ok()
    } else {
        false
    }
}

#[tauri::command]
pub fn get_api_key() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, "openai_api_key")
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    entry
        .get_password()
        .map_err(|e| format!("Failed to get API key: {}", e))
}

fn get_or_generate_master_key() -> Result<Key<Aes256Gcm>, String> {
    let entry = Entry::new(SERVICE_NAME, "safe_storage_master_key")
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    match entry.get_password() {
        Ok(encoded_key) => {
            let key_bytes = BASE64
                .decode(encoded_key)
                .map_err(|e| format!("Failed to decode master key: {}", e))?;
            if key_bytes.len() != 32 {
                return Err("Invalid master key length".to_string());
            }
            Ok(*Key::<Aes256Gcm>::from_slice(&key_bytes))
        }
        Err(_) => {
            let mut key_bytes = [0u8; 32];
            OsRng.fill_bytes(&mut key_bytes);
            let encoded_key = BASE64.encode(key_bytes);
            entry
                .set_password(&encoded_key)
                .map_err(|e| format!("Failed to store master key: {}", e))?;
            Ok(*Key::<Aes256Gcm>::from_slice(&key_bytes))
        }
    }
}

#[tauri::command]
pub fn safe_storage_encrypt(val: String) -> Result<String, String> {
    let key = get_or_generate_master_key()?;
    let cipher = Aes256Gcm::new(&key);

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, val.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut combined = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(combined))
}

#[tauri::command]
pub fn safe_storage_decrypt(val: String) -> Result<String, String> {
    let combined = BASE64
        .decode(val)
        .map_err(|e| format!("Base64 decoding failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid payload: too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = get_or_generate_master_key()?;
    let cipher = Aes256Gcm::new(&key);

    let decrypted_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(decrypted_bytes)
        .map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))
}
