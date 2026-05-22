#[tokio::test]
async fn echo_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/echo");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("echo plugin conformance");
}

#[tokio::test]
async fn search_filename_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/search-filename");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("search-filename plugin conformance");
}

#[tokio::test]
async fn thumbnail_stub_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/thumbnail-stub");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("thumbnail-stub plugin conformance");
}

#[tokio::test]
async fn viewer_text_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/viewer-text");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("viewer-text plugin conformance");
}

#[tokio::test]
async fn action_copy_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/action-copy");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("action-copy plugin conformance");
}

#[tokio::test]
async fn route_stub_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/route-stub");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("route-stub plugin conformance");
}

#[tokio::test]
async fn viewer_untrusted_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/viewer-untrusted");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("viewer-untrusted plugin conformance");
}

#[tokio::test]
async fn watcher_stub_plugin_passes_conformance() {
    let plugin = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/plugins/watcher-stub");
    zfiles::plugin::conformance::run(&plugin)
        .await
        .expect("watcher-stub plugin conformance");
}
