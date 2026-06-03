use std::fs;
use std::path::Path;
use std::sync::Arc;

use axum::http::{Method, StatusCode};
use axum_test::TestServer;
use base64::Engine;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

fn test_server(root: &Path, state_dir: &Path) -> TestServer {
    let root = root.to_path_buf();
    let state = AppState::new(
        Arc::new(LocalFs::new(root.clone())),
        AuthConfig::disabled(),
        false,
        Arc::new(StateStore::with_state_dir(root.clone(), state_dir.to_path_buf())),
        EventBus::new(),
    );
    TestServer::new(router(state)).expect("test server")
}

#[tokio::test]
async fn head_returns_upload_offset_and_length_after_partial_patch() {
    let dir = tempdir().unwrap();
    let state_dir = dir.path().join(".state");
    let server = test_server(dir.path(), &state_dir);

    let encoded = base64::engine::general_purpose::STANDARD.encode("partial.txt");
    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "6")
        .add_header("Upload-Metadata", &format!("filename {encoded}"))
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
        head.headers().get("Upload-Offset").unwrap().to_str().unwrap(),
        "3"
    );
    assert_eq!(
        head.headers().get("Upload-Length").unwrap().to_str().unwrap(),
        "6"
    );
}

#[tokio::test]
async fn patch_offset_conflict_returns_conflict() {
    let dir = tempdir().unwrap();
    let state_dir = dir.path().join(".state");
    let server = test_server(dir.path(), &state_dir);

    let encoded = base64::engine::general_purpose::STANDARD.encode("conflict.txt");
    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "3")
        .add_header("Upload-Metadata", &format!("filename {encoded}"))
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

    let encoded = base64::engine::general_purpose::STANDARD.encode("resumed.txt");
    let location = {
        let server = test_server(&root, &state_dir);
        let create = server
            .post("/api/upload")
            .add_header("Upload-Length", "6")
            .add_header("Upload-Metadata", &format!("filename {encoded}"))
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
