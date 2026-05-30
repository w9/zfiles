use tempfile::tempdir;
use zfiles::daemon::{DaemonStartArgs, pid_file, start, status, stop};

#[test]
fn daemon_start_stop_round_trip() {
    let dir = tempdir().unwrap();
    zfiles::config::Config::init_folder(dir.path()).unwrap();

    start(DaemonStartArgs {
        path: dir.path().to_path_buf(),
        host: "127.0.0.1".to_string(),
        port: 9877,
    })
    .expect("start daemon");

    let pid_path = pid_file(dir.path());
    assert!(pid_path.is_file());

    status(dir.path().to_path_buf()).expect("status while running");

    stop(dir.path().to_path_buf()).expect("stop daemon");
    assert!(!pid_path.exists());
}

#[test]
fn daemon_start_rejects_duplicate() {
    let dir = tempdir().unwrap();
    zfiles::config::Config::init_folder(dir.path()).unwrap();

    let args = DaemonStartArgs {
        path: dir.path().to_path_buf(),
        host: "127.0.0.1".to_string(),
        port: 9878,
    };
    start(args.clone()).expect("first start");
    assert!(start(args).is_err());

    stop(dir.path().to_path_buf()).expect("cleanup daemon");
}
