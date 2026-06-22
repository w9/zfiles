use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::Deserialize;

use crate::daemon::{DaemonStartArgs, start, status, stop};

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct DaemonShare {
    pub path: PathBuf,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Default)]
pub struct DaemonConfig {
    #[serde(default, rename = "share")]
    pub shares: Vec<DaemonShare>,
}

impl DaemonConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let contents = std::fs::read_to_string(path)
            .with_context(|| format!("read daemon config {}", path.display()))?;
        toml::from_str(&contents).with_context(|| format!("parse daemon config {}", path.display()))
    }
}

pub fn start_config(path: PathBuf) -> Result<()> {
    let config = DaemonConfig::load(&path)?;
    if config.shares.is_empty() {
        anyhow::bail!("daemon config contains no [[share]] entries");
    }

    for share in config.shares {
        start(DaemonStartArgs {
            path: share.path,
            bind: "127.0.0.1".to_string(),
            port: share.port,
        })?;
    }
    Ok(())
}

pub fn stop_config(path: PathBuf) -> Result<()> {
    let config = DaemonConfig::load(&path)?;
    for share in config.shares {
        stop(share.path)?;
    }
    Ok(())
}

pub fn status_config(path: PathBuf) -> Result<()> {
    let config = DaemonConfig::load(&path)?;
    if config.shares.is_empty() {
        println!("daemon config contains no [[share]] entries");
        return Ok(());
    }

    for share in config.shares {
        println!("{}:", share.path.display());
        status(share.path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn parses_share_entries() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("daemon.toml");
        std::fs::write(
            &config_path,
            r#"
            [[share]]
            path = "/tmp/a"
            port = 8080

            [[share]]
            path = "/tmp/b"
            port = 9000
            "#,
        )
        .unwrap();

        let config = DaemonConfig::load(&config_path).unwrap();
        assert_eq!(config.shares.len(), 2);
        assert_eq!(config.shares[0].port, 8080);
        assert_eq!(config.shares[1].path, PathBuf::from("/tmp/b"));
    }
}
