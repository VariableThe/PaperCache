use base64::Engine as _;
use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::header::{HeaderValue, AUTHORIZATION, ETAG, IF_MATCH};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};

const PROPFIND_BODY: &str = r#"<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/></d:prop></d:propfind>"#;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PollInfo {
    pub token: String,
    pub endpoint: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginFlowInit {
    pub poll: PollInfo,
    pub login: String,
}

/// Result of completing Nextcloud Login Flow v2. `login_name` is the DAV user
/// id (discovered, not assumed), `app_password` is the revocable per-client
/// password.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginFlowResult {
    pub server: String,
    #[serde(rename = "loginName")]
    pub login_name: String,
    #[serde(rename = "appPassword")]
    pub app_password: String,
}

/// Start Login Flow v2. Returns the browser approval URL and the poll endpoint.
pub async fn start_login_flow(base_url: &str) -> Result<LoginFlowInit, String> {
    let url = format!("{}/index.php/login/v2", base_url.trim_end_matches('/'));
    let client = Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "client": "PaperCache" }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("login flow start failed: {}", resp.status()));
    }
    resp.json::<LoginFlowInit>().await.map_err(|e| e.to_string())
}

/// Poll until the user approves (or `Ok(None)` while still pending).
pub async fn poll_login_flow(init: &LoginFlowInit) -> Result<Option<LoginFlowResult>, String> {
    let client = Client::new();
    let resp = client
        .post(&init.poll.endpoint)
        .form(&[("token", init.poll.token.as_str())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().as_u16() == 404 {
        return Ok(None); // still pending
    }
    if !resp.status().is_success() {
        return Err(format!("login flow poll failed: {}", resp.status()));
    }
    resp.json::<LoginFlowResult>().await.map(Some).map_err(|e| e.to_string())
}

pub struct NextcloudClient {
    http: Client,
    base_url: String,
    login_name: String,
    app_password: String,
}

impl NextcloudClient {
    pub fn new(base_url: &str, login_name: &str, app_password: &str) -> Self {
        Self {
            http: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            login_name: login_name.to_string(),
            app_password: app_password.to_string(),
        }
    }

    /// The DAV base: `<server>/remote.php/dav/files/<loginName>`.
    pub fn dav_base(&self) -> String {
        format!("{}/remote.php/dav/files/{}", self.base_url, self.login_name)
    }

    fn auth_header(&self) -> Result<HeaderValue, String> {
        let raw = format!("{}:{}", self.login_name, self.app_password);
        let encoded = base64::engine::general_purpose::STANDARD.encode(raw.as_bytes());
        HeaderValue::from_str(&format!("Basic {encoded}")).map_err(|e| e.to_string())
    }

    fn file_url(&self, path: &str) -> String {
        format!("{}/{}", self.dav_base(), path.trim_start_matches('/'))
    }

    /// List entries (hrefs) under `folder` via a depth-1 PROPFIND.
    pub async fn list(&self, folder: &str) -> Result<Vec<String>, String> {
        let url = self.file_url(folder);
        let resp = self
            .http
            .request(Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header(AUTHORIZATION, self.auth_header()?)
            .header("Depth", "1")
            .header("Content-Type", "application/xml; charset=utf-8")
            .body(PROPFIND_BODY.to_string())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("PROPFIND failed: {}", resp.status()));
        }
        let xml = resp.text().await.map_err(|e| e.to_string())?;
        Ok(extract_hrefs(&xml))
    }

    /// GET a file, returning its bytes and ETag (if present).
    pub async fn get(&self, path: &str) -> Result<(Vec<u8>, Option<String>), String> {
        let resp = self
            .http
            .get(self.file_url(path))
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("GET failed: {}", resp.status()));
        }
        let etag = resp
            .headers()
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
        Ok((bytes, etag))
    }

    /// PUT a file. When `if_match` is Some, the write is conditional and a
    /// 412 Precondition Failed is surfaced as an error (conflict preserved).
    /// Returns the new ETag on success.
    pub async fn put(&self, path: &str, content: &[u8], if_match: Option<&str>) -> Result<String, String> {
        let mut req = self
            .http
            .put(self.file_url(path))
            .header(AUTHORIZATION, self.auth_header()?)
            .body(content.to_vec());
        if let Some(etag) = if_match {
            req = req.header(IF_MATCH, etag);
        }
        let resp = req.send().await.map_err(|e| e.to_string())?;
        if resp.status().as_u16() == 412 {
            return Err("precondition failed (ETag mismatch); remote changed".to_string());
        }
        if !resp.status().is_success() {
            return Err(format!("PUT failed: {}", resp.status()));
        }
        Ok(resp
            .headers()
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default()
            .to_string())
    }

    pub async fn delete(&self, path: &str) -> Result<(), String> {
        let resp = self
            .http
            .delete(self.file_url(path))
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() || resp.status().as_u16() == 404 {
            return Ok(());
        }
        Err(format!("DELETE failed: {}", resp.status()))
    }

    pub async fn mkdir(&self, folder: &str) -> Result<(), String> {
        let resp = self
            .http
            .request(Method::from_bytes(b"MKCOL").unwrap(), self.file_url(folder))
            .header(AUTHORIZATION, self.auth_header()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if resp.status().is_success() || resp.status().as_u16() == 405 {
            return Ok(()); // 405 = already exists
        }
        Err(format!("MKCOL failed: {}", resp.status()))
    }
}

/// Extract `<href>` element text from a WebDAV multistatus response,
/// ignoring namespace prefixes.
pub fn extract_hrefs(xml: &str) -> Vec<String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut hrefs = Vec::new();
    let mut in_href = false;
    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                if e.local_name().as_ref() == b"href" {
                    in_href = true;
                }
            }
            Ok(Event::Text(t)) => {
                if in_href {
                    if let Ok(s) = t.decode() {
                        hrefs.push(s.into_owned());
                    }
                    in_href = false;
                }
            }
            Ok(Event::End(e)) => {
                if e.local_name().as_ref() == b"href" {
                    in_href = false;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }
    hrefs
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::{TcpListener, TcpStream};

    #[tokio::test]
    async fn login_flow_start_and_poll() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let base = format!("http://{addr}");
        let server = tokio::spawn(async move {
            // request 1: start
            let (mut s1, _) = listener.accept().await.unwrap();
            let mut b1 = vec![0u8; 8192];
            let _ = s1.read(&mut b1).await.unwrap();
            let init_body = format!(
                r#"{{"poll":{{"token":"tok1","endpoint":"http://{addr}/login/v2/poll"}},"login":"http://login"}}"#
            );
            let r1 = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                init_body.len(),
                init_body
            );
            s1.write_all(r1.as_bytes()).await.unwrap();

            // request 2: poll
            let (mut s2, _) = listener.accept().await.unwrap();
            let mut b2 = vec![0u8; 8192];
            let _ = s2.read(&mut b2).await.unwrap();
            let result_body = r#"{"server":"http://server","loginName":"alice","appPassword":"app-pw"}"#;
            let r2 = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                result_body.len(),
                result_body
            );
            s2.write_all(r2.as_bytes()).await.unwrap();
        });

        let init = start_login_flow(&base).await.unwrap();
        assert_eq!(init.poll.token, "tok1");
        let result = poll_login_flow(&init).await.unwrap().expect("approved");
        assert_eq!(result.login_name, "alice");
        assert_eq!(result.app_password, "app-pw");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn put_with_if_match_conflict() {
        // Mock returns 412 when If-Match is present and mismatched.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 8192];
            let n = stream.read(&mut buf).await.unwrap();
            let req = String::from_utf8_lossy(&buf[..n]).to_lowercase();
            assert!(
                req.contains("if-match: \"old-etag\""),
                "request should carry If-Match"
            );
            stream
                .write_all(b"HTTP/1.1 412 Precondition Failed\r\nContent-Length: 0\r\n\r\n")
                .await
                .unwrap();
        });

        let c = NextcloudClient::new(&format!("http://{addr}"), "alice", "pw");
        let err = c.put("PaperCache/notes/a.md", b"new", Some("\"old-etag\"")).await;
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("precondition failed"));
        server.await.unwrap();
    }

    #[tokio::test]
    async fn put_without_etag_succeeds_and_returns_new_etag() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 8192];
            let _ = stream.read(&mut buf).await.unwrap();
            stream
                .write_all(b"HTTP/1.1 201 Created\r\nETag: \"new-etag\"\r\nContent-Length: 0\r\n\r\n")
                .await
                .unwrap();
        });

        let c = NextcloudClient::new(&format!("http://{addr}"), "alice", "pw");
        let etag = c.put("PaperCache/notes/a.md", b"new", None).await.unwrap();
        assert_eq!(etag, "\"new-etag\"");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn get_returns_bytes_and_etag() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 8192];
            let _ = stream.read(&mut buf).await.unwrap();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nETag: \"abc\"\r\nContent-Length: 5\r\n\r\nhello")
                .await
                .unwrap();
        });

        let c = NextcloudClient::new(&format!("http://{addr}"), "alice", "pw");
        let (bytes, etag) = c.get("PaperCache/notes/a.md").await.unwrap();
        assert_eq!(bytes, b"hello");
        assert_eq!(etag.as_deref(), Some("\"abc\""));
        server.await.unwrap();
    }
}
