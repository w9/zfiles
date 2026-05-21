use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::plugins::PluginSupervisor;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

#[tokio::test]
async fn list_small_fixture_under_sla() {
    let dir = tempdir().unwrap();
    let script = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/generate-fixtures.sh");
    let status = Command::new("bash")
        .arg(&script)
        .arg(dir.path())
        .status()
        .expect("run generate-fixtures.sh");
    assert!(status.success());

    let state = AppState {
        fs: Arc::new(LocalFs::new(dir.path().join("small"))),
        auth: AuthConfig::disabled(),
        read_only: false,
        state: Arc::new(StateStore::new(dir.path().join("small"))),
        events: EventBus::new(),
        plugins: Arc::new(PluginSupervisor::new(dir.path().join("small"))),
    };
    let server = TestServer::new(router(state)).expect("test server");

    let start = Instant::now();
    let response = server.get("/api/list").await;
    response.assert_status_ok();
    assert!(
        start.elapsed() < Duration::from_millis(500),
        "list took {:?}",
        start.elapsed()
    );
}
