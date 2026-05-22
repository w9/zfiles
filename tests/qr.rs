use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use tempfile::tempdir;

#[test]
fn public_bind_with_token_prints_scannable_qr_code() {
    let dir = tempdir().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_zfiles"))
        .args(["--listen", "0.0.0.0:0", "--token", "--no-open"])
        .arg(dir.path())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn zfiles");

    let stdout = child.stdout.take().expect("stdout");
    let reader = BufReader::new(stdout);
    let start = Instant::now();
    let mut output = String::new();

    for line in reader.lines() {
        let line = line.expect("stdout line");
        output.push_str(&line);
        output.push('\n');
        if line.contains("listening") || start.elapsed() > Duration::from_secs(10) {
            break;
        }
    }

    let _ = child.kill();
    let _ = child.wait();

    let dark_modules = zfiles::qr::dark_module_count(&output);
    assert!(
        dark_modules >= zfiles::qr::MIN_DARK_MODULES,
        "expected scannable QR in startup output, found {dark_modules} dark modules:\n{output}"
    );
    assert!(
        output.contains("token=zfiles-"),
        "expected share URL with token in startup output:\n{output}"
    );
}
