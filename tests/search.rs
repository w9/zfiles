use std::fs;
use std::sync::Arc;
use std::time::Duration;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::{FileEntry, LocalFs};
use zfiles::plugins::PluginSupervisor;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

fn test_server_with_plugins(root: &std::path::Path) -> TestServer {
    let plugins = Arc::new(PluginSupervisor::new(root.to_path_buf()));
    let events = EventBus::new();
    plugins.clone().start_background(events.clone());

    let state = AppState {
        fs: Arc::new(LocalFs::new(root.to_path_buf())),
        auth: AuthConfig::disabled(),
        read_only: false,
        state: Arc::new(StateStore::new(root.to_path_buf())),
        events,
        plugins,
    };
    TestServer::new(router(state)).expect("test server")
}

async fn wait_for_searcher(server: &TestServer) {
    for _ in 0..50 {
        let response = server.get("/api/plugins").await;
        let plugins: Vec<serde_json::Value> = response.json();
        if plugins.iter().any(|plugin| {
            plugin["capabilities"]
                .as_array()
                .is_some_and(|caps| caps.iter().any(|cap| cap == "searcher"))
        }) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("searcher plugin did not become ready");
}

#[tokio::test]
async fn search_returns_matching_files() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("notes.txt"), b"x").unwrap();
    fs::write(dir.path().join("photos.jpg"), b"x").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/search-filename");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_searcher(&server).await;

    let response = server.get("/api/search?q=notes").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "notes.txt");
}

#[tokio::test]
async fn download_uses_sendfile_fast_path_on_linux() {
    assert!(zfiles::download::uses_sendfile_fast_path());
}
