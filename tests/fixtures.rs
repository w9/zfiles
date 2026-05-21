use std::process::Command;
use std::sync::Arc;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::{FileEntry, LocalFs};
use zfiles::plugins::PluginSupervisor;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

fn test_server(root: &std::path::Path) -> TestServer {
    let state = AppState {
        fs: Arc::new(LocalFs::new(root.to_path_buf())),
        auth: AuthConfig::disabled(),
        read_only: false,
        state: Arc::new(StateStore::new(root.to_path_buf())),
        events: EventBus::new(),
        plugins: Arc::new(PluginSupervisor::new(root.to_path_buf())),
    };
    TestServer::new(router(state)).expect("test server")
}

#[test]
fn init_creates_dotfolder() {
    let dir = tempdir().unwrap();
    let root = dir.path().canonicalize().unwrap();
    let config_path = zfiles::config::Config::init_folder(&root).unwrap();
    assert!(config_path.is_file());
    assert!(root.join(".zfiles/plugins").is_dir());
}

#[tokio::test]
async fn small_fixture_lists_expected_files() {
    let dir = tempdir().unwrap();
    let script = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/generate-fixtures.sh");
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
