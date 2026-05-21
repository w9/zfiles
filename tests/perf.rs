use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum_test::TestServer;
use base64::Engine;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::plugins::PluginSupervisor;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

const ONE_MIB: usize = 1024 * 1024;

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

#[tokio::test]
async fn download_one_mib_under_sla() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("large.bin"), vec![0u8; ONE_MIB]).unwrap();

    let state = AppState {
        fs: Arc::new(LocalFs::new(dir.path().to_path_buf())),
        auth: AuthConfig::disabled(),
        read_only: false,
        state: Arc::new(StateStore::new(dir.path().to_path_buf())),
        events: EventBus::new(),
        plugins: Arc::new(PluginSupervisor::new(dir.path().to_path_buf())),
    };
    let server = TestServer::new(router(state)).expect("test server");

    let start = Instant::now();
    let response = server.get("/api/file?path=large.bin").await;
    response.assert_status_ok();
    assert_eq!(
        response
            .headers()
            .get("content-length")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string),
        Some(ONE_MIB.to_string())
    );
    assert!(
        start.elapsed() < Duration::from_secs(2),
        "download took {:?}",
        start.elapsed()
    );
}

#[tokio::test]
async fn upload_one_mib_under_sla() {
    let dir = tempdir().unwrap();
    let state = AppState {
        fs: Arc::new(LocalFs::new(dir.path().to_path_buf())),
        auth: AuthConfig::disabled(),
        read_only: false,
        state: Arc::new(StateStore::new(dir.path().to_path_buf())),
        events: EventBus::new(),
        plugins: Arc::new(PluginSupervisor::new(dir.path().to_path_buf())),
    };
    let server = TestServer::new(router(state)).expect("test server");

    let payload = vec![7u8; ONE_MIB];
    let encoded = base64::engine::general_purpose::STANDARD.encode("large-upload.bin");
    let start = Instant::now();
    let create = server
        .post("/api/upload")
        .add_header("Upload-Length", &ONE_MIB.to_string())
        .add_header("Upload-Metadata", &format!("filename {encoded}"))
        .await;
    create.assert_status(axum::http::StatusCode::CREATED);

    let location = create
        .headers()
        .get("location")
        .and_then(|value| value.to_str().ok())
        .expect("upload location");
    let patch = server
        .patch(location)
        .add_header("Upload-Offset", "0")
        .bytes(payload.into())
        .await;
    patch.assert_status(axum::http::StatusCode::NO_CONTENT);

    assert!(
        start.elapsed() < Duration::from_secs(3),
        "upload took {:?}",
        start.elapsed()
    );
    assert!(dir.path().join("large-upload.bin").is_file());
}
