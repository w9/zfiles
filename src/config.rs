use std::path::Path;

use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Default)]
pub struct Config {
    #[serde(default)]
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Default)]
pub struct ServerConfig {
    pub read_only: Option<bool>,
    pub open_browser: Option<bool>,
}

impl Config {
    pub fn load(root: &Path) -> Result<Self> {
        let path = root.join(".zfiles/config.toml");
        if !path.is_file() {
            return Ok(Self::default());
        }

        let contents = std::fs::read_to_string(&path)
            .with_context(|| format!("read config {}", path.display()))?;
        toml::from_str(&contents).with_context(|| format!("parse config {}", path.display()))
    }

    pub fn read_only(&self) -> bool {
        self.server.read_only.unwrap_or(false)
    }

    pub fn open_browser(&self) -> bool {
        self.server.open_browser.unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn defaults_when_missing() {
        let dir = tempdir().unwrap();
        let config = Config::load(dir.path()).unwrap();
        assert!(!config.read_only());
        assert!(config.open_browser());
    }

    #[test]
    fn parses_existing_file() {
        let dir = tempdir().unwrap();
        let dot = dir.path().join(".zfiles");
        std::fs::create_dir_all(&dot).unwrap();
        std::fs::write(
            dot.join("config.toml"),
            "[server]\nread_only = true\nopen_browser = false\n",
        )
        .unwrap();

        let config = Config::load(dir.path()).unwrap();
        assert!(config.read_only());
        assert!(!config.open_browser());
    }
}
