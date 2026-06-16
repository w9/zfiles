use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use tempfile::tempdir;

#[test]
fn public_bind_with_token_prints_scannable_qr_code() {
    let dir = tempdir().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_zfiles"))
        .args(["--host", "0.0.0.0", "--port", "0", "--token", "--no-open"])
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
        let dark_modules = zfiles::qr::dark_module_count(&output);
        if dark_modules >= zfiles::qr::MIN_DARK_MODULES || start.elapsed() > Duration::from_secs(10)
        {
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
        output.contains("▸  Share:")
            && output
                .lines()
                .any(|line| line.contains("http://") && line.contains("token=")),
        "expected share URL with hex token in startup banner:\n{output}"
    );
    assert!(
        output.contains("▸  QR:") && output.contains("scan below"),
        "expected QR hint in startup banner:\n{output}"
    );
}
