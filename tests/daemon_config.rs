use std::fs;
use std::time::Duration;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::config::Config;
use zfiles::daemon::pid_file;
use zfiles::daemon_config::{start_config, status_config, stop_config};
use zfiles::plugins::PluginSupervisor;
use zfiles::xdg;

#[test]
fn daemon_config_start_stop_round_trip() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let share_a = dir.path().join("share-a");
    let share_b = dir.path().join("share-b");
    fs::create_dir_all(&share_a).unwrap();
    fs::create_dir_all(&share_b).unwrap();
    Config::init_folder(&share_a).unwrap();
    Config::init_folder(&share_b).unwrap();

    let config_path = dir.path().join("daemon.toml");
    fs::write(
        &config_path,
        format!(
            r#"
            [[share]]
            path = "{}"
            port = 19881

            [[share]]
            path = "{}"
            port = 19882
            "#,
            share_a.display(),
            share_b.display()
        ),
    )
    .unwrap();

    start_config(config_path.clone()).expect("start daemon config");
    assert!(pid_file(&share_a).is_file());
    assert!(pid_file(&share_b).is_file());

    status_config(config_path.clone()).expect("status daemon config");
    stop_config(config_path).expect("stop daemon config");

    assert!(!pid_file(&share_a).exists());
    assert!(!pid_file(&share_b).exists());
}

fn test_server_with_plugins(root: &std::path::Path) -> TestServer {
    use std::sync::Arc;

    use zfiles::auth::AuthConfig;
    use zfiles::events::EventBus;
    use zfiles::fs::LocalFs;
    use zfiles::state::StateStore;
    use zfiles::transport::{router, AppState};

    let plugins = Arc::new(PluginSupervisor::new(root.to_path_buf()));
    let events = EventBus::new();
    zfiles::watch::start(root.to_path_buf(), events.clone()).expect("watch");
    plugins.clone().start_watcher_dispatch(events.clone());
    plugins.clone().start_background(events.clone());

    let state = AppState::new(
        Arc::new(LocalFs::new(root.to_path_buf())),
        AuthConfig::disabled(),
        false,
        Arc::new(StateStore::new(root.to_path_buf())),
        events,
        plugins,
    );
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
async fn watcher_plugin_receives_filesystem_notify() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/watcher-stub");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "watcher").await;

    std::fs::write(dir.path().join("created.txt"), b"new file").unwrap();

    let notify_path = xdg::user_plugins_dir()
        .join("watcher-stub/data/last_notify.txt");
    for _ in 0..50 {
        if notify_path.is_file() {
            let contents = std::fs::read_to_string(&notify_path).unwrap();
            if contents.contains("created.txt") {
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    panic!("watcher plugin did not record filesystem notify");
}
