use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail};

#[derive(Clone)]
pub struct DaemonStartArgs {
    pub path: PathBuf,
    pub port: Option<u16>,
}

pub fn pid_file(root: &Path) -> PathBuf {
    root.join(".zfiles/daemon.pid")
}

pub fn start(args: DaemonStartArgs) -> Result<()> {
    let root = std::fs::canonicalize(&args.path)
        .with_context(|| format!("failed to resolve path {}", args.path.display()))?;
    let pid_path = pid_file(&root);

    if let Some(pid) = read_pid(&pid_path)? {
        if process_alive(pid) {
            bail!("daemon already running with pid {pid}");
        }
        let _ = std::fs::remove_file(&pid_path);
    }

    std::fs::create_dir_all(root.join(".zfiles"))?;

    let exe = std::env::current_exe().context("resolve current executable")?;
    let mut cmd = Command::new(&exe);
    cmd.arg("--no-open");
    if let Some(port) = args.port {
        cmd.args(["--port", &port.to_string()]);
    }
    cmd.arg(&root);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());

    let child = cmd.spawn().context("spawn daemon process")?;
    std::fs::write(&pid_path, child.id().to_string()).context("write daemon pid file")?;
    println!(
        "Started daemon pid {} serving {}",
        child.id(),
        root.display()
    );
    Ok(())
}

pub fn stop(path: PathBuf) -> Result<()> {
    let root = std::fs::canonicalize(&path)
        .with_context(|| format!("failed to resolve path {}", path.display()))?;
    let pid_path = pid_file(&root);
    let Some(pid) = read_pid(&pid_path)? else {
        println!("No daemon pid file at {}", pid_path.display());
        return Ok(());
    };

    if process_alive(pid) {
        signal_process(pid)?;
        for _ in 0..20 {
            if !process_alive(pid) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    let _ = std::fs::remove_file(&pid_path);
    println!("Stopped daemon pid {pid}");
    Ok(())
}

pub fn status(path: PathBuf) -> Result<()> {
    let root = std::fs::canonicalize(&path)
        .with_context(|| format!("failed to resolve path {}", path.display()))?;
    let pid_path = pid_file(&root);
    let Some(pid) = read_pid(&pid_path)? else {
        println!("daemon: stopped");
        return Ok(());
    };

    if process_alive(pid) {
        println!("daemon: running (pid {pid})");
    } else {
        println!("daemon: stale pid file ({pid})");
    }
    Ok(())
}

fn read_pid(path: &Path) -> Result<Option<u32>> {
    if !path.is_file() {
        return Ok(None);
    }
    let contents = std::fs::read_to_string(path).context("read daemon pid file")?;
    let pid = contents
        .trim()
        .parse::<u32>()
        .context("parse daemon pid file")?;
    Ok(Some(pid))
}

fn process_alive(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .is_ok_and(|status| status.success())
}

#[cfg(unix)]
fn signal_process(pid: u32) -> Result<()> {
    use std::process::Command;
    Command::new("kill")
        .arg(pid.to_string())
        .status()
        .context("signal daemon process")?;
    Ok(())
}

#[cfg(not(unix))]
fn signal_process(_pid: u32) -> Result<()> {
    bail!("daemon stop is only supported on Unix");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn pid_file_lives_under_dotfolder() {
        let dir = tempdir().unwrap();
        assert_eq!(
            pid_file(dir.path()),
            dir.path().join(".zfiles/daemon.pid")
        );
    }
}
