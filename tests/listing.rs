use std::fs;
use std::sync::Arc;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::fs::{FileEntry, LocalFs};
use zfiles::transport::{AppState, router};

fn test_server(root: &std::path::Path) -> TestServer {
    let state = AppState {
        fs: Arc::new(LocalFs::new(root.to_path_buf())),
        auth: AuthConfig::disabled(),
    };
    TestServer::new(router(state)).expect("test server")
}

#[tokio::test]
async fn health_returns_ok() {
    let dir = tempdir().unwrap();
    let server = test_server(dir.path());

    let response = server.get("/api/health").await;
    response.assert_status_ok();
    response.assert_json(&serde_json::json!({ "status": "ok" }));
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
