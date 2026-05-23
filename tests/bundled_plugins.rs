use std::sync::Arc;
use std::time::Duration;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::bundled_plugins;
use zfiles::events::EventBus;
use zfiles::fs::LocalFs;
use zfiles::plugins::PluginSupervisor;
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};

fn test_server_with_bundled_plugins(root: &std::path::Path) -> TestServer {
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

async fn wait_for_plugin(server: &TestServer, name: &str) {
    for _ in 0..100 {
        let response = server.get("/api/plugins").await;
        let plugins: Vec<serde_json::Value> = response.json();
        if plugins.iter().any(|plugin| plugin["name"] == name) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("plugin {name} did not become ready");
}

#[tokio::test]
async fn bundled_image_thumbnailer_is_discovered_without_install() {
    let dir = tempdir().unwrap();
    let cache = dir.path().join("cache");
    bundled_plugins::set_test_cache_base(Some(cache));

    let server = test_server_with_bundled_plugins(dir.path());
    wait_for_plugin(&server, "image-thumbnailer").await;

    let response = server.get("/api/plugins").await;
    response.assert_status_ok();

    let plugins: Vec<serde_json::Value> = response.json();
    let plugin = plugins
        .iter()
        .find(|plugin| plugin["name"] == "image-thumbnailer")
        .expect("image-thumbnailer plugin");
    assert!(
        plugin["capabilities"]
            .as_array()
            .is_some_and(|caps| caps.iter().any(|cap| cap == "viewer"))
    );
    assert_eq!(
        plugin["viewerModule"],
        serde_json::json!("/plugin/image-thumbnailer/viewer.js")
    );

    let module = server.get("/plugin/image-thumbnailer/viewer.js").await;
    module.assert_status_ok();
    assert!(module.text().contains("export"));

    bundled_plugins::set_test_cache_base(None);
}
