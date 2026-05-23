use std::fs;
use std::sync::Arc;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::plugins::PluginSupervisor;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

#[tokio::test]
async fn download_large_file_returns_full_body() {
    let dir = tempdir().unwrap();
    let size = 3_500_000usize;
    fs::write(dir.path().join("big.jpg"), vec![7u8; size]).unwrap();

    let state = AppState {
        fs: Arc::new(LocalFs::new(dir.path().to_path_buf())),
        auth: AuthConfig::disabled(),
        read_only: false,
        state: Arc::new(StateStore::new(dir.path().to_path_buf())),
        events: EventBus::new(),
        plugins: Arc::new(PluginSupervisor::new(dir.path().to_path_buf())),
    };
    let server = TestServer::new(router(state)).expect("test server");

    let response = server.get("/api/file?path=big.jpg").await;
    response.assert_status_ok();
    assert_eq!(response.into_bytes().len(), size);
}
