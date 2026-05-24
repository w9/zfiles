use std::fs;
use std::sync::Arc;

use axum_test::TestServer;
use rust_embed::Embed;
use tempfile::tempdir;
use zfiles::auth::{self, AuthConfig};
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

#[derive(Embed)]
#[folder = "web/dist/"]
struct DistAssets;

fn embedded_asset_path() -> String {
    let path = DistAssets::iter()
        .find(|path| path.starts_with("assets/"))
        .expect("embedded frontend asset");
    format!("/{path}")
}

fn embedded_file_icon_path() -> String {
    let path = DistAssets::iter()
        .find(|path| path.starts_with("file-icons/") && path.ends_with(".svg"))
        .expect("embedded file icon");
    format!("/{path}")
}

fn test_server_with_token(root: &std::path::Path, token: &str, expires_at: Option<i64>) -> TestServer {
    let plugins = Arc::new(zfiles::plugins::PluginSupervisor::new(root.to_path_buf()));
    let state_store = Arc::new(StateStore::new(root.to_path_buf()));
    if let Some(expires_at) = expires_at {
        state_store
            .create_session(token, expires_at)
            .expect("session row");
    }
    let state = AppState::new(
        Arc::new(LocalFs::new(root.to_path_buf())),
        AuthConfig::with_token(token.to_string(), expires_at),
        false,
        state_store,
        EventBus::new(),
        plugins,
    );
    TestServer::new(router(state)).expect("test server")
}

#[test]
fn is_public_path_classifies_embedded_assets() {
    assert!(auth::is_public_path("/assets/index.js"));
    assert!(auth::is_public_path("/assets/index.css"));
    assert!(auth::is_public_path("/file-icons/javascript.svg"));
    assert!(auth::is_public_path("/favicon.ico"));
    assert!(auth::is_public_path("/viewer-sandbox.html"));
    assert!(!auth::is_public_path("/api/list"));
    assert!(!auth::is_public_path("/"));
}

#[tokio::test]
async fn tokenized_server_serves_embedded_assets_without_credentials() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let server = test_server_with_token(dir.path(), "a1b2c3d4e5f6789012345678abcdef01", None);
    let asset_path = embedded_asset_path();

    let response = server.get(&asset_path).await;
    response.assert_status_ok();
}

#[tokio::test]
async fn tokenized_server_serves_file_icons_without_credentials() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let server = test_server_with_token(dir.path(), "a1b2c3d4e5f6789012345678abcdef01", None);
    let icon_path = embedded_file_icon_path();

    let response = server.get(&icon_path).await;
    response.assert_status_ok();
}

#[tokio::test]
async fn tokenized_server_rejects_api_without_credentials() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let server = test_server_with_token(dir.path(), "a1b2c3d4e5f6789012345678abcdef01", None);

    let response = server.get("/api/list").await;
    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn tokenized_server_accepts_bearer_token_without_expiry_session() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let server = test_server_with_token(dir.path(), "a1b2c3d4e5f6789012345678abcdef01", None);

    let response = server
        .get("/api/list")
        .add_header("Authorization", "Bearer a1b2c3d4e5f6789012345678abcdef01")
        .await;
    response.assert_status_ok();
}

#[tokio::test]
async fn tokenized_server_accepts_token_query_without_expiry_session() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let server = test_server_with_token(dir.path(), "a1b2c3d4e5f6789012345678abcdef01", None);

    let response = server.get("/api/list?token=a1b2c3d4e5f6789012345678abcdef01").await;
    response.assert_status_ok();
}

#[tokio::test]
async fn expiring_token_requires_session_row() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let future = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
        + 3600;
    let server = test_server_with_token(dir.path(), "b2c3d4e5f6789012345678abcdef0123", Some(future));

    let response = server
        .get("/api/list")
        .add_header("Authorization", "Bearer b2c3d4e5f6789012345678abcdef0123")
        .await;
    response.assert_status_ok();
}
