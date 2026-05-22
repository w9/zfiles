use tempfile::tempdir;
use zfiles::config::Config;
use zfiles::state::StateStore;

#[test]
fn relocated_dotfolder_stores_state_outside_serve_root() {
    let dir = tempdir().unwrap();
    let external = dir.path().join("external-dotfolder");
    std::fs::create_dir_all(dir.path().join(".zfiles")).unwrap();
    std::fs::write(
        dir.path().join(".zfiles/config.toml"),
        format!("[state]\ndotfolder_path = {:?}\n", external),
    )
    .unwrap();

    let store = StateStore::new(dir.path().to_path_buf());
    store.ensure_dotfolder().unwrap();
    assert!(external.is_dir());
    assert!(!dir.path().join(".zfiles/state.db").exists());

    store.create_upload("file.txt".into(), None).unwrap();
    assert!(external.join("state.db").exists());
}

#[test]
fn config_get_set_dotfolder_path_round_trip() {
    let dir = tempdir().unwrap();
    let external = dir.path().join("relocated");
    let mut config = Config::default();
    config
        .set("state.dotfolder_path", &external.display().to_string())
        .unwrap();
    assert_eq!(
        config.get("state.dotfolder_path").unwrap(),
        Some(external.display().to_string())
    );
}
