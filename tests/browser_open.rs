use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use tempfile::tempdir;

fn is_hex_token(token: &str) -> bool {
    token.len() == 32 && token.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn box_line_content(raw: &str) -> &str {
    raw.trim().trim_start_matches('│').trim_end_matches('│').trim()
}

fn token_from_banner(output: &str) -> Option<String> {
    let mut saw_heading = false;
    for line in output.lines() {
        let content = box_line_content(line);
        if content == "Auth token (for API and CLI clients):" {
            saw_heading = true;
            continue;
        }
        if saw_heading && is_hex_token(content) {
            return Some(content.to_string());
        }
    }
    None
}

fn collect_startup_stdout(args: &[&str], dir: &std::path::Path) -> String {
    let mut child = Command::new(env!("CARGO_BIN_EXE_zfiles"))
        .args(args)
        .arg(dir)
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
        if line.contains("Press Ctrl+C to stop.") || start.elapsed() > Duration::from_secs(10) {
            break;
        }
    }

    let _ = child.kill();
    let _ = child.wait();

    output
}

#[test]
fn serve_prints_startup_banner_with_explorer_url() {
    let dir = tempdir().unwrap();
    let output = collect_startup_stdout(&[], dir.path());

    assert!(
        output.contains("zfiles is running"),
        "expected startup banner:\n{output}"
    );
    assert!(
        output.contains("Open in your browser:"),
        "expected browser instruction in banner:\n{output}"
    );
    assert!(
        output
            .lines()
            .map(box_line_content)
            .any(|line| line.contains("http://127.0.0.1:")),
        "expected explorer URL in banner:\n{output}"
    );
    assert!(
        output.contains("Opening your default browser…"),
        "expected browser launch hint:\n{output}"
    );
}

#[test]
fn serve_with_token_includes_token_in_banner_url() {
    let dir = tempdir().unwrap();
    let output = collect_startup_stdout(&["--token"], dir.path());

    let url_line = output
        .lines()
        .map(box_line_content)
        .find(|line| line.contains("http://127.0.0.1:") && line.contains("token="))
        .expect("expected tokenized explorer URL in banner:\n{output}");
    let token = url_line
        .split("token=")
        .nth(1)
        .and_then(|rest| rest.split(['/', '&']).next())
        .expect("token query in explorer URL");
    assert!(
        is_hex_token(token),
        "expected 32-char hex token in explorer URL:\n{url_line}"
    );
}

#[test]
fn token_startup_prints_hex_auth_token_in_banner() {
    let dir = tempdir().unwrap();
    let output = collect_startup_stdout(&["--token", "--no-open"], dir.path());

    assert!(
        output.contains("Auth token (for API and CLI clients):"),
        "expected auth token section in banner:\n{output}"
    );

    let token = token_from_banner(&output).expect("token in auth banner section:\n{output}");
    assert!(
        is_hex_token(&token),
        "expected 32-char hex auth token, got {token:?}"
    );
}

#[test]
fn no_open_banner_omits_browser_launch_hint() {
    let dir = tempdir().unwrap();
    let output = collect_startup_stdout(&["--no-open"], dir.path());

    assert!(
        output.contains("Open the URL above in your browser."),
        "expected manual open instruction:\n{output}"
    );
    assert!(
        !output.contains("Opening your default browser"),
        "did not expect browser launch hint with --no-open:\n{output}"
    );
}

#[test]
fn serve_with_lang_includes_lang_in_banner_url() {
    let dir = tempdir().unwrap();
    let output = collect_startup_stdout(&["--no-open", "--lang", "zh-CN"], dir.path());

    assert!(
        output
            .lines()
            .map(box_line_content)
            .any(|line| line.contains("lang=zh-CN")),
        "expected lang query in explorer URL:\n{output}"
    );
}
