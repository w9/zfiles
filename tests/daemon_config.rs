use std::fs;

use axum_test::TestServer;
use tempfile::tempdir;
use zfiles::config::Config;
use zfiles::daemon::pid_file;
use zfiles::daemon_config::{start_config, status_config, stop_config};
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
