use std::process::Command;
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

async fn wait_for_plugin(server: &TestServer, capability: &str) {
    for _ in 0..50 {
        let response = server.get("/api/plugins").await;
        let plugins: Vec<serde_json::Value> = response.json();
        if plugins.iter().any(|plugin| {
            plugin["capabilities"]
                .as_array()
                .is_some_and(|caps| caps.iter().any(|cap| cap == capability))
        }) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("plugin with capability {capability} did not become ready");
}

#[tokio::test]
async fn thumbnail_returns_png_bytes() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("photo.jpg"), b"fake jpeg").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/thumbnail-stub");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "thumbnailer").await;

    let response = server.get("/api/thumbnail?path=photo.jpg").await;
    response.assert_status_ok();
    assert!(response.headers().get("content-type").is_some());
    assert!(!response.as_bytes().is_empty());
}

#[tokio::test]
async fn preview_returns_text_body() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("notes.txt"), b"hello preview").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/viewer-text");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "viewer").await;

    let response = server.get("/api/preview?path=notes.txt").await;
    response.assert_status_ok();
    assert_eq!(response.text(), "hello preview");
}

#[tokio::test]
async fn unicode_fixture_lists_special_filenames() {
    let dir = tempdir().unwrap();
    let script = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/generate-fixtures.sh");
    Command::new("bash")
        .arg(&script)
        .arg(dir.path())
        .status()
        .expect("run generate-fixtures.sh");

    let server = test_server_with_plugins(&dir.path().join("unicode"));
    let response = server.get("/api/list").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert!(entries.len() >= 2);
}

#[tokio::test]
async fn deep_fixture_lists_nested_directory() {
    let dir = tempdir().unwrap();
    let script = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/generate-fixtures.sh");
    Command::new("bash")
        .arg(&script)
        .arg(dir.path())
        .status()
        .expect("run generate-fixtures.sh");

    let server = test_server_with_plugins(&dir.path().join("deep"));
    let response = server
        .get("/api/list?path=level-1/level-2/level-3")
        .await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert!(entries.iter().any(|entry| entry.name == "readme.txt"));
}

#[tokio::test]
async fn actions_returns_context_menu_items() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/action-copy");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "action").await;

    let response = server.get("/api/actions?path=notes.txt").await;
    response.assert_status_ok();

    let actions: Vec<serde_json::Value> = response.json();
    assert_eq!(actions.len(), 1);
    assert_eq!(actions[0]["id"], "copy-path");
    assert_eq!(actions[0]["label"], "Copy path");
}

#[tokio::test]
async fn prefetch_publishes_thumbnail_ready() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("photo.jpg"), b"fake jpeg").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/thumbnail-stub");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let plugins = Arc::new(PluginSupervisor::new(dir.path().to_path_buf()));
    let events = EventBus::new();
    plugins.clone().start_background(events.clone());
    let mut rx = events.subscribe();

    for _ in 0..50 {
        if plugins.has_thumbnailer() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(plugins.has_thumbnailer());

    let entries = vec![FileEntry {
        name: "photo.jpg".into(),
        path: "photo.jpg".into(),
        is_dir: false,
        size: 9,
        modified: None,
        extra: None,
    }];
    plugins.prefetch_thumbnails(&entries, events);

    let event = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let Ok(zfiles::events::KernelEvent::ThumbnailReady { path, url }) = rx.recv().await {
                return (path, url);
            }
        }
    })
    .await
    .expect("thumbnail_ready event");

    assert_eq!(event.0, "photo.jpg");
    assert!(event.1.contains("photo.jpg"));
}

#[tokio::test]
async fn viewer_module_exposed_in_plugins_api() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/viewer-text");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "viewer").await;

    let response = server.get("/api/plugins").await;
    response.assert_status_ok();

    let plugins: Vec<serde_json::Value> = response.json();
    let viewer = plugins
        .iter()
        .find(|plugin| plugin["name"] == "viewer-text")
        .expect("viewer-text plugin");
    assert_eq!(
        viewer["viewerModule"],
        "/plugin/viewer-text/module.js"
    );
}

#[tokio::test]
async fn plugin_static_serves_viewer_module() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/viewer-text");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    let response = server.get("/plugin/viewer-text/module.js").await;
    response.assert_status_ok();
    assert!(response.text().contains("export function mount"));
}

#[tokio::test]
async fn action_run_returns_no_content() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/action-copy");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "action").await;

    let response = server
        .post("/api/actions")
        .json(&serde_json::json!({
            "path": "notes.txt",
            "action_id": "copy-path",
        }))
        .await;
    response.assert_status(axum::http::StatusCode::NO_CONTENT);
}
