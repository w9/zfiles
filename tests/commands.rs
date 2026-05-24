use tempfile::tempdir;
use zfiles::config::Config;
use zfiles::plugins::PluginSupervisor;
use zfiles::xdg;

#[test]
fn config_set_and_get_round_trip() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let root = dir.path().canonicalize().unwrap();
    let mut config = Config::load(&root).unwrap();
    config.set("server.read_only", "true").unwrap();
    config.save_to(&Config::folder_config_path(&root)).unwrap();

    let loaded = Config::load(&root).unwrap();
    assert!(loaded.read_only());
}

#[test]
fn plugin_install_copies_manifest() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let root = dir.path().canonicalize().unwrap();
    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/plugins/echo");

    let record = PluginSupervisor::new(root.clone())
        .install(&source)
        .unwrap();

    assert_eq!(record.manifest.name, "echo");
    assert!(record.root.join("manifest.toml").is_file());
    assert!(record.root.join("bin/echo").is_file());
    assert!(record.root.starts_with(xdg::user_plugins_dir()));
}

#[test]
fn plugin_list_discovers_installed_plugin() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let root = dir.path().canonicalize().unwrap();
    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/plugins/echo");
    let supervisor = PluginSupervisor::new(root.clone());
    supervisor.install(&source).unwrap();

    let plugins = supervisor.list().unwrap();
    assert!(plugins.iter().any(|plugin| plugin.manifest.name == "echo"));
}

#[test]
fn plugin_remove_deletes_installed_plugin() {
    let dir = tempdir().unwrap();
    let _homes = xdg::TestHomes::new(dir.path().to_path_buf());
    let root = dir.path().canonicalize().unwrap();
    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/plugins/echo");
    let supervisor = PluginSupervisor::new(root.clone());
    supervisor.install(&source).unwrap();

    supervisor.remove("echo").unwrap();
    assert!(!xdg::user_plugins_dir().join("echo").exists());
}
