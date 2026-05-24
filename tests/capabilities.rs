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
use zfiles::xdg;

fn test_server_with_plugins(root: &std::path::Path) -> TestServer {
    let plugins = Arc::new(PluginSupervisor::new(root.to_path_buf()));
    let events = EventBus::new();
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
async fn thumbnail_returns_png_bytes() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    assert_eq!(actions[0]["source"], "manifest");

    let catalog = server.get("/api/actions/catalog").await;
    catalog.assert_status_ok();
    let catalog_actions: Vec<serde_json::Value> = catalog.json();
    assert!(catalog_actions.iter().any(|action| action["id"] == "copy-path"));
    let copy_path = catalog_actions
        .iter()
        .find(|action| action["id"] == "copy-path")
        .expect("copy-path in catalog");
    assert_eq!(
        copy_path["category"].as_str(),
        Some("actions.selection.category")
    );
    assert_eq!(
        copy_path["default_keybinding"].as_str(),
        Some("Mod+Shift+C")
    );

    let keybindings = server.get("/api/keybindings").await;
    keybindings.assert_status_ok();
}

#[tokio::test]
async fn prefetch_publishes_thumbnail_ready() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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

    for _ in 0..100 {
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
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

#[tokio::test]
async fn bulk_action_run_accepts_paths_array() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    std::fs::write(dir.path().join("a.txt"), b"a").unwrap();
    std::fs::write(dir.path().join("b.txt"), b"b").unwrap();

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
            "paths": ["a.txt", "b.txt"],
            "action_id": "copy-path",
        }))
        .await;
    response.assert_status(axum::http::StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn thumbnail_uses_on_disk_cache() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    std::fs::write(dir.path().join("photo.jpg"), b"fake jpeg").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/thumbnail-stub");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "thumbnailer").await;

    let first = server.get("/api/thumbnail?path=photo.jpg").await;
    first.assert_status_ok();

    let cache_dir = xdg::plugin_data_dir("thumbnail-stub").join("thumbnails");
    assert!(cache_dir.is_dir());
    assert!(std::fs::read_dir(&cache_dir).unwrap().count() >= 2);

    let second = server.get("/api/thumbnail?path=photo.jpg").await;
    second.assert_status_ok();
}

#[tokio::test]
async fn route_plugin_handles_dynamic_path() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/route-stub");
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "route").await;

    let response = server.get("/plugin/route-stub/api/greeting").await;
    response.assert_status_ok();
    assert!(response.text().contains("hello from route-stub"));
}

#[tokio::test]
async fn untrusted_viewer_reports_trusted_false() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();

    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/viewer-untrusted");
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
        .find(|plugin| plugin["name"] == "viewer-untrusted")
        .expect("viewer-untrusted plugin");
    assert_eq!(viewer["trusted"], false);
}

fn build_image_thumbnailer_plugin() -> std::path::PathBuf {
    let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let plugin_dir = root.join("plugins/image-thumbnailer");
    let status = Command::new("cargo")
        .current_dir(&root)
        .args(["build", "-p", "image-thumbnailer", "--quiet"])
        .status()
        .expect("build image-thumbnailer plugin");
    assert!(status.success(), "image-thumbnailer build failed");
    std::fs::create_dir_all(plugin_dir.join("bin")).expect("create plugin bin directory");
    std::fs::copy(
        root.join("target/debug/image-thumbnailer"),
        plugin_dir.join("bin/image-thumbnailer"),
    )
    .expect("copy image-thumbnailer binary");
    plugin_dir
}

fn write_test_png(path: &std::path::Path) {
    use std::io::Cursor;

    use image::{ImageBuffer, Rgba};

    let png = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_fn(128, 96, |x, y| {
        if (x / 16 + y / 16) % 2 == 0 {
            Rgba([220, 80, 80, 255])
        } else {
            Rgba([40, 120, 220, 255])
        }
    });
    let mut bytes = Vec::new();
    png.write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
        .expect("encode png");
    std::fs::write(path, bytes).expect("write png fixture");
}

#[tokio::test]
async fn image_thumbnailer_returns_webp_and_serves_viewer_module() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    write_test_png(&dir.path().join("photo.png"));

    let source = build_image_thumbnailer_plugin();
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "thumbnailer").await;
    wait_for_plugin(&server, "viewer").await;

    let list = server.get("/api/list").await;
    list.assert_status_ok();
    let mut entries: Vec<FileEntry> = list.json();
    for _ in 0..20 {
        if entries
            .iter()
            .find(|entry| entry.name == "photo.png")
            .and_then(|entry| entry.extra.as_ref())
            .is_some()
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
        let response = server.get("/api/list").await;
        response.assert_status_ok();
        entries = response.json();
    }

    let grid = server.get("/api/thumbnail?path=photo.png&tier=grid").await;
    grid.assert_status_ok();
    assert!(
        grid
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains("webp"))
    );
    assert!(!grid.as_bytes().is_empty());

    let preview = server.get("/api/thumbnail?path=photo.png&tier=preview").await;
    preview.assert_status_ok();
    assert!(preview.as_bytes().len() >= grid.as_bytes().len());

    let module = server.get("/plugin/image-thumbnailer/viewer.js").await;
    module.assert_status_ok();
    assert!(module.text().contains("image-viewer"));
}

fn build_sibling_plugin(package: &str, binary: &str, plugin_dir: &std::path::Path) {
    let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let status = Command::new("cargo")
        .current_dir(&root)
        .args(["build", "-p", package, "--quiet"])
        .status()
        .unwrap_or_else(|_| panic!("build {package} plugin"));
    assert!(status.success(), "{package} build failed");
    std::fs::create_dir_all(plugin_dir.join("bin")).expect("create plugin bin directory");
    std::fs::copy(
        root.join(format!("target/debug/{binary}")),
        plugin_dir.join(format!("bin/{binary}")),
    )
    .unwrap_or_else(|_| panic!("copy {binary} binary"));
}

#[tokio::test]
async fn plugin_i18n_catalog_exposes_locale_bundles() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let source = build_image_thumbnailer_plugin();
    PluginSupervisor::new(dir.path().to_path_buf())
        .install(&source)
        .unwrap();

    let server = test_server_with_plugins(dir.path());
    let response = server.get("/api/plugins/i18n").await;
    response.assert_status_ok();

    let catalog: serde_json::Value = response.json();
    assert_eq!(
        catalog["image-thumbnailer"]["en"]["plugin.image-thumbnailer.actions.slideshow.name"],
        serde_json::json!("Slideshow")
    );
    assert_eq!(
        catalog["image-thumbnailer"]["zh-CN"]["plugin.image-thumbnailer.actions.slideshow.name"],
        serde_json::json!("幻灯片放映")
    );
}

#[tokio::test]
async fn sibling_thumbnailer_plugins_register_with_kernel() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let supervisor = PluginSupervisor::new(dir.path().to_path_buf());

    for (package, name) in [
        ("thumbnailer-raw", "thumbnailer-raw"),
        ("thumbnailer-heic", "thumbnailer-heic"),
    ] {
        let plugin_dir = root.join(format!("plugins/{name}"));
        build_sibling_plugin(package, name, &plugin_dir);
        supervisor.install(&plugin_dir).unwrap();
    }

    let server = test_server_with_plugins(dir.path());
    wait_for_plugin(&server, "thumbnailer").await;

    let response = server.get("/api/plugins").await;
    response.assert_status_ok();
    let plugins: Vec<serde_json::Value> = response.json();
    let names: std::collections::HashSet<_> = plugins
        .iter()
        .filter_map(|plugin| plugin["name"].as_str())
        .collect();
    assert!(names.contains("thumbnailer-raw"));
    assert!(names.contains("thumbnailer-heic"));
}
