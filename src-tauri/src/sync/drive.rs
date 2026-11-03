use reqwest::header::{HeaderValue, AUTHORIZATION, IF_MATCH};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const DRIVE_API: &str = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3";

/// Publisher configuration for the Google Drive backend. Real authorization is
/// gated on this being present; without it the client refuses to act (it does
/// not fake a successful sync).
#[derive(Clone, Debug)]
pub struct DriveConfig {
    pub client_id: String,
    pub client_secret: String,
    pub refresh_token: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_in: Option<u64>,
    #[serde(default)]
    pub token_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DriveFile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub head_revision_id: Option<String>,
    #[serde(default)]
    pub md5_checksum: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct FileList {
    #[serde(default)]
    pub files: Vec<DriveFile>,
}

/// A Drive client explicitly gated on publisher configuration. Identity sign-in
/// and Drive authorization are separate; this deals only with the Drive side,
/// using a revocable refresh token (never the primary account password).
pub struct DriveClient {
    http: Client,
    config: Option<DriveConfig>,
    access_token: Option<String>,
    token_url: String,
    api_url: String,
    upload_url: String,
}

impl DriveClient {
    pub fn new(config: Option<DriveConfig>) -> Self {
        Self {
            http: Client::new(),
            config,
            access_token: None,
            token_url: TOKEN_URL.to_string(),
            api_url: DRIVE_API.to_string(),
            upload_url: DRIVE_UPLOAD.to_string(),
        }
    }

    /// Override the endpoints (used by tests to point at a mock server).
    pub fn with_endpoints(mut self, token_url: &str, api_url: &str, upload_url: &str) -> Self {
        self.token_url = token_url.to_string();
        self.api_url = api_url.to_string();
        self.upload_url = upload_url.to_string();
        self
    }

    pub fn is_configured(&self) -> bool {
        self.config.is_some()
    }

    fn require_config(&self) -> Result<(), String> {
        if self.config.is_none() {
            return Err("Drive not configured (no client id/secret/refresh token)".to_string());
        }
        Ok(())
    }

    fn auth_header(&self) -> Result<HeaderValue, String> {
        let token = self
            .access_token
            .as_deref()
            .ok_or("no access token; call refresh first")?;
        HeaderValue::from_str(&format!("Bearer {token}")).map_err(|e| e.to_string())
    }

    /// Refresh (or first-acquire) the access token from the stored refresh token.
    pub async fn refresh_access_token(&mut self) -> Result<String, String> {
        self.require_config()?;
        let cfg = self.config.as_ref().unwrap();
        let resp = self
            .http
            .post(&self.token_url)
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", cfg.refresh_token.as_str()),
                ("client_id", cfg.client_id.as_str()),
                ("client_secret", cfg.client_secret.as_str()),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("token refresh failed: {}", resp.status()));
        }
        let tok: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
        self.access_token = Some(tok.access_token.clone());
        Ok(tok.access_token)
    }

    /// Exchange an authorization code for tokens (authorization-code flow).
    pub async fn exchange_code(
        code: &str,
        client_id: &str,
        client_secret: &str,
        redirect_uri: &str,
    ) -> Result<TokenResponse, String> {
        let resp = Client::new()
            .post(TOKEN_URL)
            .form(&[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("redirect_uri", redirect_uri),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("authorization failed: {}", resp.status()));
        }
        resp.json().await.map_err(|e| e.to_string())
    }

    /// List files in a folder (visible PaperCache folder), minimal metadata.
    pub async fn list(&self, folder_id: &str) -> Result<Vec<DriveFile>, String> {
        let q = urlencode(&format!("'{folder_id}' in parents and trashed = false"));
        let url = format!(
            "{}/files?q={}&fields=files(id,name,mimeType,headRevisionId,md5Checksum)",
            self.api_url, q
        );
        let resp = self
            .http
            .get(&url)
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("list failed: {}", resp.status()));
        }
        let list: FileList = resp.json().await.map_err(|e| e.to_string())?;
        Ok(list.files)
    }

    /// Download a file's media bytes plus its head revision id (for conditional
    /// writes).
    pub async fn get(&self, file_id: &str) -> Result<(Vec<u8>, Option<String>), String> {
        let meta: DriveFile = self.get_metadata(file_id).await?;
        let resp = self
            .http
            .get(format!("{}/files/{file_id}?alt=media", self.api_url))
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("get failed: {}", resp.status()));
        }
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
        Ok((bytes, meta.head_revision_id))
    }

    async fn get_metadata(&self, file_id: &str) -> Result<DriveFile, String> {
        let url = format!(
            "{}/files/{file_id}?fields=id,name,mimeType,headRevisionId,md5Checksum",
            self.api_url
        );
        let resp = self
            .http
            .get(&url)
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("metadata failed: {}", resp.status()));
        }
        resp.json().await.map_err(|e| e.to_string())
    }

    /// Create (or update, when `file_id` is Some) a file via multipart upload.
    /// `if_revision` makes an update conditional (412 on mismatch -> conflict).
    pub async fn put(
        &self,
        file_id: Option<&str>,
        name: &str,
        parent_folder: &str,
        content: &[u8],
        if_revision: Option<&str>,
    ) -> Result<DriveFile, String> {
        let boundary = "papercache_boundary";
        let metadata = serde_json::json!({ "name": name, "parents": [parent_folder] });
        let body = multipart_body(boundary, &metadata.to_string(), content);

        let url = match file_id {
            Some(id) => format!("{}/files/{id}?uploadType=multipart", self.upload_url),
            None => format!("{}/files?uploadType=multipart", self.upload_url),
        };
        let method = if file_id.is_some() {
            Method::PATCH
        } else {
            Method::POST
        };

        let mut req = self
            .http
            .request(method, &url)
            .header(AUTHORIZATION, self.auth_header()?)
            .header(
                "Content-Type",
                format!("multipart/related; boundary={boundary}"),
            )
            .body(body);
        if let Some(rev) = if_revision {
            req = req.header(IF_MATCH, rev);
        }

        let resp = req.send().await.map_err(|e| e.to_string())?;
        if resp.status().as_u16() == 412 {
            return Err("precondition failed (revision mismatch); remote changed".to_string());
        }
        if !resp.status().is_success() {
            return Err(format!("put failed: {}", resp.status()));
        }
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn delete(&self, file_id: &str) -> Result<(), String> {
        let resp = self
            .http
            .delete(format!("{}/files/{file_id}", self.api_url))
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() || resp.status().as_u16() == 404 {
            return Ok(());
        }
        Err(format!("delete failed: {}", resp.status()))
    }
}

fn multipart_body(boundary: &str, metadata_json: &str, content: &[u8]) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(b"Content-Type: application/json; charset=UTF-8\r\n\r\n");
    body.extend_from_slice(metadata_json.as_bytes());
    body.extend_from_slice(format!("\r\n--{boundary}\r\n").as_bytes());
    body.extend_from_slice(b"Content-Type: text/plain\r\n\r\n");
    body.extend_from_slice(content);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

/// Minimal RFC 3986 percent-encoding for the query string.
fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn cfg() -> DriveConfig {
        DriveConfig {
            client_id: "cid".into(),
            client_secret: "secret".into(),
            refresh_token: "rt".into(),
        }
    }

    async fn respond(stream: &mut tokio::net::TcpStream, status: &str, body: &str) {
        let resp = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        stream.write_all(resp.as_bytes()).await.unwrap();
    }

    async fn read_req(stream: &mut tokio::net::TcpStream) -> String {
        let mut buf = vec![0u8; 16384];
        let n = stream.read(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf[..n]).to_string()
    }

    #[tokio::test]
    async fn unconfigured_client_refuses_to_act() {
        let mut c = DriveClient::new(None);
        assert!(!c.is_configured());
        assert!(c.refresh_access_token().await.is_err());
    }

    #[tokio::test]
    async fn refresh_exchanges_refresh_token() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let req = read_req(&mut s).await;
            assert!(req.contains("grant_type=refresh_token"));
            respond(&mut s, "200 OK", r#"{"access_token":"at-123","expires_in":3600}"#).await;
        });

        let mut c = DriveClient::new(Some(cfg()))
            .with_endpoints(&format!("http://{addr}/token"), "", "");
        let tok = c.refresh_access_token().await.unwrap();
        assert_eq!(tok, "at-123");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn put_sends_bearer_and_content() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let req = read_req(&mut s).await;
            assert!(req.contains("Bearer at-123"));
            assert!(req.contains("# hello"), "multipart body should carry content");
            respond(&mut s, "200 OK", r#"{"id":"f1","name":"a.md"}"#).await;
        });

        let mut c = DriveClient::new(Some(cfg()))
            .with_endpoints("", "", &format!("http://{addr}/upload"));
        c.access_token = Some("at-123".into());
        let f = c.put(None, "a.md", "papercache", b"# hello", None).await.unwrap();
        assert_eq!(f.id, "f1");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn put_with_revision_conflict() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let req = read_req(&mut s).await.to_lowercase();
            assert!(req.contains("if-match: \"rev1\""), "should carry If-Match");
            s.write_all(b"HTTP/1.1 412 Precondition Failed\r\nContent-Length: 0\r\n\r\n")
                .await
                .unwrap();
        });

        let mut c = DriveClient::new(Some(cfg()))
            .with_endpoints("", "", &format!("http://{addr}/upload"));
        c.access_token = Some("at-123".into());
        let err = c
            .put(Some("f1"), "a.md", "papercache", b"new", Some("\"rev1\""))
            .await;
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("precondition failed"));
        server.await.unwrap();
    }
}
