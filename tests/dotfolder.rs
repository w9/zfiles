use tempfile::tempdir;
use zfiles::config::Config;
use zfiles::state::StateStore;
use zfiles::xdg;

fn with_test_homes<F: FnOnce()>(base: std::path::PathBuf, f: F) {
    xdg::set_test_config_home(Some(base.join("config")));
    xdg::set_test_cache_home(Some(base.join("cache")));
    f();
    xdg::set_test_config_home(None);
    xdg::set_test_cache_home(None);
}

#[test]
fn xdg_state_dir_stores_state_outside_serve_root() {
    let dir = tempdir().unwrap();
    with_test_homes(dir.path().to_path_buf(), || {
        let root = dir.path().canonicalize().unwrap();
        let store = StateStore::new(root.clone());
        store.ensure_state_dir().unwrap();
        assert!(store.state_dir().starts_with(xdg::config_home()));
        assert!(!store.state_dir().starts_with(&root));

        store.create_upload("file.txt".into(), None).unwrap();
        assert!(store.state_dir().join("state.db").exists());
    });
}

#[test]
fn config_get_set_round_trip() {
    let dir = tempdir().unwrap();
    with_test_homes(dir.path().to_path_buf(), || {
        let root = dir.path().canonicalize().unwrap();
        let mut config = Config::default();
        config.set("server.read_only", "true").unwrap();
        config.save_to(&Config::folder_config_path(&root)).unwrap();

        let loaded = Config::load(&root).unwrap();
        assert!(loaded.read_only());
    });
}
