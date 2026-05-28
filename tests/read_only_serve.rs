use std::fs;
use std::sync::Arc;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::auth::AuthConfig;
use zfiles::config::Config;
use zfiles::dotfolder;
use zfiles::events::EventBus;
use zfiles::fs::{FileEntry, LocalFs};
use zfiles::state::StateStore;
use zfiles::transport::{AppState, router};
use zfiles::xdg;

fn test_server_for_layout(root: &std::path::Path, config: &Config, cli_read_only: bool) -> TestServer {
    let layout = dotfolder::plan_serve_layout(root, config, cli_read_only);
    let state = AppState::new(
        Arc::new(LocalFs::new(root.to_path_buf())),
        AuthConfig::disabled(),
        layout.read_only,
        Arc::new(StateStore::with_state_dir(
            root.to_path_buf(),
            layout.state_dir.clone(),
        )),
        EventBus::new(),
    );
    TestServer::new(router(state)).expect("test server")
}

#[cfg(unix)]
fn make_read_only(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;

    let metadata = fs::metadata(path).unwrap();
    let mut permissions = metadata.permissions();
    permissions.set_mode(metadata.permissions().mode() & !0o222);
    fs::set_permissions(path, permissions).unwrap();
}

#[tokio::test]
async fn read_only_serve_root_lists_and_reports_read_only() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
    let root = dir.path().canonicalize().unwrap();

    #[cfg(unix)]
    make_read_only(&root);

    let server = test_server_for_layout(&root, &Config::default(), false);

    let health = server.get("/api/health").await;
    health.assert_status_ok();
    health.assert_json(&serde_json::json!({
        "status": "ok",
        "read_only": true,
        "follow_symlinks_outside_root": false,
    }));

    let response = server.get("/api/list").await;
    response.assert_status_ok();

    let entries: Vec<FileEntry> = response.json();
    assert!(entries.iter().any(|entry| entry.name == "notes.txt"));

    let layout = dotfolder::plan_serve_layout(&root, &Config::default(), false);
    assert!(layout.auto_read_only);
    assert!(!layout.state_dir.starts_with(&root));
    assert!(layout.state_dir.starts_with(xdg::config_home()));
}
