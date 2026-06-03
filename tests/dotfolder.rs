use tempfile::tempdir;
use zfiles::config::Config;
use zfiles::state::StateStore;
use zfiles::xdg;

#[test]
fn xdg_state_dir_stores_state_outside_serve_root() {
    let dir = tempdir().unwrap();
    xdg::with_test_homes(dir.path().to_path_buf(), || {
        let root = dir.path().join("share");
        std::fs::create_dir_all(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let store = StateStore::new(root.clone());
        store.ensure_state_dir().unwrap();
        assert!(store.state_dir().starts_with(xdg::config_home()));
        assert!(!store.state_dir().starts_with(&root));

        let record = store.create_upload("file.txt".into(), Some(0)).unwrap();
        let meta = store
            .state_dir()
            .join("uploads")
            .join(format!("{}.meta.json", record.id));
        assert!(meta.is_file(), "expected sidecar meta at {}", meta.display());
        assert!(
            !store.state_dir().join("state.db").exists(),
            "state.db should not be created"
        );
    });
}

#[test]
fn config_get_set_round_trip() {
    let dir = tempdir().unwrap();
    xdg::with_test_homes(dir.path().to_path_buf(), || {
        let root = dir.path().join("share");
        std::fs::create_dir_all(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let mut config = Config::default();
        config.set("server.read_only", "true").unwrap();
        config.save_to(&Config::folder_config_path(&root)).unwrap();

        let loaded = Config::load(&root).unwrap();
        assert!(loaded.read_only());
    });
}
