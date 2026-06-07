use std::fs;
use std::sync::Arc;

use axum_test::TestServer;
use base64::Engine;
use reqwest::Client;
use sha2::{Digest, Sha256};
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};
use zfiles::upload::{UploadOptions, upload_file};

fn test_server(root: &std::path::Path) -> TestServer {
    let state = AppState::new(
        Arc::new(LocalFs::new(root.to_path_buf())),
        AuthConfig::disabled(),
        false,
        Arc::new(StateStore::new(root.to_path_buf())),
        EventBus::new(),
    );
    TestServer::builder()
        .http_transport()
        .build(router(state))
        .expect("test server")
}

#[tokio::test]
async fn cli_upload_module_writes_file() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());
    let server_url = server.server_address().expect("server address").to_string();
    let local = dir.path().join("payload.bin");
    fs::write(&local, b"hello upload").unwrap();

    upload_file(UploadOptions {
        server: &server_url,
        file: &local,
        target_path: "remote.bin",
        token: None,
        resume: false,
    })
    .await
    .expect("upload file");

    let contents = fs::read_to_string(dir.path().join("remote.bin")).unwrap();
    assert_eq!(contents, "hello upload");
}

#[tokio::test]
async fn cli_upload_resumes_from_offset() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());
    let server_url = server.server_address().expect("server address").to_string();
    let local = dir.path().join("chunked.bin");
    fs::write(&local, b"abcdef").unwrap();

    let client = Client::new();
    let encoded = base64::engine::general_purpose::STANDARD.encode("partial.bin");
    let checksum = base64::engine::general_purpose::STANDARD.encode(Sha256::digest(b"abcdef"));
    let create = client
        .post(format!("{}/api/upload", server_url.trim_end_matches('/')))
        .header("Upload-Length", "6")
        .header(
            "Upload-Metadata",
            format!("filename {encoded},checksum {checksum}"),
        )
        .send()
        .await
        .expect("create upload");
    let location = create
        .headers()
        .get(reqwest::header::LOCATION)
        .expect("location header")
        .to_str()
        .expect("location utf8")
        .to_string();
    let location = format!("{}{}", server_url.trim_end_matches('/'), location);

    client
        .patch(&location)
        .header("Upload-Offset", "0")
        .header("Content-Type", "application/offset+octet-stream")
        .body(b"abc".to_vec())
        .send()
        .await
        .expect("partial patch")
        .error_for_status()
        .expect("partial patch status");

    let state = serde_json::json!({
        "location": location,
        "checksum_sha256": checksum,
    });
    fs::write(
        local.with_extension("zfiles-upload.json"),
        state.to_string(),
    )
    .unwrap();

    upload_file(UploadOptions {
        server: &server_url,
        file: &local,
        target_path: "partial.bin",
        token: None,
        resume: true,
    })
    .await
    .expect("resume upload");

    let contents = fs::read_to_string(dir.path().join("partial.bin")).unwrap();
    assert_eq!(contents, "abcdef");
}
