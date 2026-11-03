use sha2::{Digest, Sha256};

/// Hex-encoded SHA-256 of the input bytes.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}
