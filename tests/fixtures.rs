use std::process::Command;
use std::sync::Arc;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::config::Config;
use zfiles::events::EventBus;
use zfiles::fs::{FileEntry, LocalFs};
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};
use zfiles::xdg;

fn test_server(root: &std::path::Path) -> TestServer {
    let state = AppState::new(
        Arc::new(LocalFs::new(root.to_path_buf())),
        AuthConfig::disabled(),
        false,
        Arc::new(StateStore::new(root.to_path_buf())),
        EventBus::new(),
    );
    TestServer::new(router(state)).expect("test server")
}

#[test]
fn init_creates_xdg_config() {
    let dir = tempdir().unwrap();
    xdg::with_test_homes(dir.path().to_path_buf(), || {
        let root = dir.path().canonicalize().unwrap();
        let global = Config::init_global().unwrap();
        assert!(global.is_file());
        let folder = Config::init_folder(&root).unwrap();
        assert!(folder.is_file());
        assert!(folder.starts_with(xdg::config_home()));
    });
}

#[tokio::test]
async fn small_fixture_lists_expected_files() {
    let dir = tempdir().unwrap();
    let script =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/generate-fixtures.sh");
    let status = Command::new("bash")
        .arg(&script)
        .arg(dir.path())
        .status()
        .expect("run generate-fixtures.sh");
    assert!(status.success());

    let server = test_server(&dir.path().join("small"));
    let response = server.get("/api/list").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert!(entries.len() >= 20);
    assert!(entries.iter().any(|entry| entry.name == "notes.txt"));
}
