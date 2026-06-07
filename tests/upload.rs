use std::fs;
use std::path::Path;
use std::sync::Arc;

use axum::http::{Method, StatusCode};
use axum_test::TestServer;
use base64::Engine;
use sha2::{Digest, Sha256};
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

fn sha256_b64(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(Sha256::digest(data))
}

fn upload_metadata(path: &str, data: &[u8]) -> String {
    format!(
        "filename {},checksum {}",
        base64::engine::general_purpose::STANDARD.encode(path),
        sha256_b64(data)
    )
}

fn test_server(root: &Path, state_dir: &Path) -> TestServer {
    let root = root.to_path_buf();
    let state = AppState::new(
        Arc::new(LocalFs::new(root.clone())),
        AuthConfig::disabled(),
        false,
        Arc::new(StateStore::with_state_dir(
            root.clone(),
            state_dir.to_path_buf(),
        )),
        EventBus::new(),
    );
    TestServer::new(router(state)).expect("test server")
}

#[tokio::test]
async fn create_upload_requires_checksum_metadata() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path(), &dir.path().join(".state"));

    let encoded = base64::engine::general_purpose::STANDARD.encode("missing.txt");
    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "1")
        .add_header("Upload-Metadata", &format!("filename {encoded}"))
        .await;
    create.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn head_returns_upload_offset_and_length_after_partial_patch() {
    let dir = tempdir().unwrap();
    let state_dir = dir.path().join(".state");
    let server = test_server(dir.path(), &state_dir);

    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "6")
        .add_header(
            "Upload-Metadata",
            &upload_metadata("partial.txt", b"abcdef"),
        )
        .await;
    create.assert_status(StatusCode::CREATED);

    let location = create
        .headers()
        .get("location")
        .expect("location header")
        .to_str()
        .unwrap()
        .to_string();

    server
        .patch(&location)
        .add_header("Upload-Offset", "0")
        .bytes(b"abc".to_vec().into())
        .await
        .assert_status(StatusCode::NO_CONTENT);

    let head = server.method(Method::HEAD, &location).await;
    head.assert_status(StatusCode::OK);
    assert_eq!(
        head.headers()
            .get("Upload-Offset")
            .unwrap()
            .to_str()
            .unwrap(),
        "3"
    );
    assert_eq!(
        head.headers()
            .get("Upload-Length")
            .unwrap()
            .to_str()
            .unwrap(),
        "6"
    );
}

#[tokio::test]
async fn patch_offset_conflict_returns_conflict() {
    let dir = tempdir().unwrap();
    let state_dir = dir.path().join(".state");
    let server = test_server(dir.path(), &state_dir);

    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "3")
        .add_header("Upload-Metadata", &upload_metadata("conflict.txt", b"abc"))
        .await;
    create.assert_status(StatusCode::CREATED);

    let location = create
        .headers()
        .get("location")
        .expect("location header")
        .to_str()
        .unwrap()
        .to_string();

    server
        .patch(&location)
        .add_header("Upload-Offset", "0")
        .bytes(b"ab".to_vec().into())
        .await
        .assert_status(StatusCode::NO_CONTENT);

    let conflict = server
        .patch(&location)
        .add_header("Upload-Offset", "0")
        .bytes(b"x".to_vec().into())
        .await;
    conflict.assert_status(StatusCode::CONFLICT);
}

#[tokio::test]
async fn patch_after_server_restart_resumes_upload() {
    let dir = tempdir().unwrap();
    let root = dir.path().to_path_buf();
    let state_dir = dir.path().join(".state");

    let location = {
        let server = test_server(&root, &state_dir);
        let create = server
            .post("/api/upload")
            .add_header("Upload-Length", "6")
            .add_header(
                "Upload-Metadata",
                &upload_metadata("resumed.txt", b"abcdef"),
            )
            .await;
        create.assert_status(StatusCode::CREATED);
        create
            .headers()
            .get("location")
            .expect("location header")
            .to_str()
            .unwrap()
            .to_string()
    };

    {
        let server = test_server(&root, &state_dir);
        server
            .patch(&location)
            .add_header("Upload-Offset", "0")
            .bytes(b"abc".to_vec().into())
            .await
            .assert_status(StatusCode::NO_CONTENT);
    }

    let server = test_server(&root, &state_dir);
    server
        .patch(&location)
        .add_header("Upload-Offset", "3")
        .bytes(b"def".to_vec().into())
        .await
        .assert_status(StatusCode::NO_CONTENT);

    assert_eq!(
        fs::read_to_string(root.join("resumed.txt")).unwrap(),
        "abcdef"
    );
}

#[tokio::test]
async fn checksum_mismatch_rejects_upload_and_cleans_spool() {
    let dir = tempdir().unwrap();
    let state_dir = dir.path().join(".state");
    let server = test_server(dir.path(), &state_dir);

    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "3")
        .add_header("Upload-Metadata", &upload_metadata("bad.txt", b"xxx"))
        .await;
    create.assert_status(StatusCode::CREATED);

    let location = create
        .headers()
        .get("location")
        .expect("location header")
        .to_str()
        .unwrap()
        .to_string();

    let patch = server
        .patch(&location)
        .add_header("Upload-Offset", "0")
        .bytes(b"abc".to_vec().into())
        .await;
    patch.assert_status(StatusCode::BAD_REQUEST);

    assert!(!dir.path().join("bad.txt").exists());
    assert!(fs::read_dir(state_dir.join("uploads")).unwrap().count() == 0);
}
