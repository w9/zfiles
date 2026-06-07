use std::fs;
use std::sync::Arc;

use axum_test::TestServer;
use base64::Engine;
use sha2::{Digest, Sha256};
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::{FileEntry, FileStat, LocalFs};
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

fn test_server(root: &std::path::Path) -> TestServer {
    test_server_with_options(root, false)
}

fn test_server_with_options(root: &std::path::Path, read_only: bool) -> TestServer {
    let root = root.to_path_buf();
    let state = AppState::new(
        Arc::new(LocalFs::new(root.clone())),
        AuthConfig::disabled(),
        read_only,
        Arc::new(StateStore::with_state_dir(
            root.clone(),
            root.join(".state"),
        )),
        EventBus::new(),
    );
    TestServer::new(router(state)).expect("test server")
}

#[tokio::test]
async fn health_returns_ok() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());

    let response = server.get("/api/health").await;
    response.assert_status_ok();
    response.assert_json(&serde_json::json!({
        "status": "ok",
        "read_only": false,
        "follow_symlinks_outside_root": false,
    }));
}

#[tokio::test]
async fn list_directory_returns_entries() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    fs::create_dir(dir.path().join("photos")).unwrap();

    let server = test_server(dir.path());

    let response = server.get("/api/list").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert_eq!(entries.len(), 2);
    assert!(entries.iter().any(|entry| entry.name == "notes.txt"));
    assert!(
        entries
            .iter()
            .any(|entry| entry.name == "photos" && entry.is_dir)
    );
}

#[tokio::test]
async fn macos_pictures_folder_lists_if_present() {
    let pictures = std::path::Path::new("/Users/xunzhu/Pictures");
    if !pictures.is_dir() {
        return;
    }

    let server = test_server(&pictures.canonicalize().unwrap());

    let response = server.get("/api/list").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert!(!entries.is_empty());
}

#[tokio::test]
async fn list_subdirectory() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir(&nested).unwrap();
    fs::write(nested.join("inner.txt"), b"x").unwrap();

    let server = test_server(dir.path());

    let response = server.get("/api/list?path=nested").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "inner.txt");
}

#[tokio::test]
async fn stat_returns_metadata() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let server = test_server(dir.path());
    let response = server.get("/api/metadata?path=notes.txt").await;
    response.assert_status_ok();

    let stat: FileStat = response.json();
    assert_eq!(stat.path, "notes.txt");
    assert!(!stat.is_dir);
    assert_eq!(stat.size, 5);
}

#[tokio::test]
async fn download_full_file() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello world").unwrap();

    let server = test_server(dir.path());
    let response = server.get("/api/file?path=notes.txt").await;
    response.assert_status_ok();
    assert_eq!(response.text(), "hello world");
}

#[tokio::test]
async fn download_partial_file() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello world").unwrap();

    let server = test_server(dir.path());
    let response = server
        .get("/api/file?path=notes.txt")
        .add_header("Range", "bytes=6-10")
        .await;
    response.assert_status(axum::http::StatusCode::PARTIAL_CONTENT);
    assert_eq!(response.text(), "world");
}

#[tokio::test]
async fn tus_upload_completes_file() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());

    let encoded = base64::engine::general_purpose::STANDARD.encode("uploaded.txt");
    let checksum = base64::engine::general_purpose::STANDARD.encode(Sha256::digest(b"hello"));
    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "5")
        .add_header(
            "Upload-Metadata",
            &format!("filename {encoded},checksum {checksum}"),
        )
        .await;
    create.assert_status(axum::http::StatusCode::CREATED);

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
        .bytes(b"hello".to_vec().into())
        .await;
    patch.assert_status(axum::http::StatusCode::NO_CONTENT);

    let list = server.get("/api/list").await;
    let entries: Vec<FileEntry> = list.json();
    assert!(entries.iter().any(|entry| entry.name == "uploaded.txt"));

    let contents = fs::read_to_string(dir.path().join("uploaded.txt")).unwrap();
    assert_eq!(contents, "hello");
}

#[tokio::test]
async fn read_only_blocks_uploads() {
    let dir = tempdir().unwrap();
    let server = test_server_with_options(dir.path(), true);

    let encoded = base64::engine::general_purpose::STANDARD.encode("blocked.txt");
    let checksum = base64::engine::general_purpose::STANDARD.encode([0u8; 32]);
    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", "1")
        .add_header(
            "Upload-Metadata",
            &format!("filename {encoded},checksum {checksum}"),
        )
        .await;

    create.assert_status(axum::http::StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn delete_action_removes_files() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    fs::write(dir.path().join("other.txt"), b"world").unwrap();

    let server = test_server(dir.path());
    let response = server
        .post("/api/actions")
        .json(&serde_json::json!({
            "paths": ["notes.txt", "other.txt"],
            "action_id": "file.delete",
        }))
        .await;
    response.assert_status(axum::http::StatusCode::NO_CONTENT);
    assert!(!dir.path().join("notes.txt").exists());
    assert!(!dir.path().join("other.txt").exists());
}

#[tokio::test]
async fn mkdir_rename_copy_actions() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("seed.txt"), b"seed").unwrap();
    let server = test_server(dir.path());

    server
        .post("/api/actions")
        .json(&serde_json::json!({
            "action_id": "file.mkdir",
            "paths": [""],
            "new_name": "nested",
        }))
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);
    assert!(dir.path().join("nested").is_dir());

    server
        .post("/api/actions")
        .json(&serde_json::json!({
            "action_id": "file.rename",
            "paths": ["nested"],
            "new_name": "renamed",
        }))
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);
    assert!(dir.path().join("renamed").is_dir());

    server
        .post("/api/actions")
        .json(&serde_json::json!({
            "action_id": "file.copy",
            "paths": ["seed.txt"],
            "dest_dir": "renamed",
        }))
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);
    assert!(dir.path().join("renamed/seed.txt").exists());
}

#[tokio::test]
async fn read_only_blocks_delete() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let server = test_server_with_options(dir.path(), true);
    let response = server
        .post("/api/actions")
        .json(&serde_json::json!({
            "paths": ["notes.txt"],
            "action_id": "file.delete",
        }))
        .await;
    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    assert!(dir.path().join("notes.txt").exists());
}

#[tokio::test]
async fn index_fallback_is_served() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());

    let response = server.get("/").await;
    response.assert_status_ok();
    let body = response.text();
    assert!(body.contains("zfiles") || body.contains("placeholder"));
}

#[tokio::test]
async fn removed_plugin_and_search_routes_return_not_found() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());

    for path in [
        "/api/plugins",
        "/api/plugins/i18n",
        "/api/search?q=test",
        "/api/thumbnail?path=notes.txt",
        "/api/preview?path=notes.txt",
        "/plugin/image-thumbnailer/viewer.js",
    ] {
        let response = server.get(path).await;
        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }
}
