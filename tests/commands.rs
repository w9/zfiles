use tempfile::tempdir;
use zfiles::config::Config;
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
