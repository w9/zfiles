use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

use crate::xdg;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
pub struct Config {
    #[serde(default)]
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
pub struct ServerConfig {
    pub read_only: Option<bool>,
    pub open_browser: Option<bool>,
}

impl Config {
    pub fn global_config_path() -> PathBuf {
        xdg::global_config_path()
    }

    pub fn folder_config_path(serve_root: &Path) -> PathBuf {
        xdg::folder_config_path(serve_root)
    }

    pub fn load(serve_root: &Path) -> Result<Self> {
        let global = Self::load_from(&Self::global_config_path())?;
        let folder = Self::load_from(&Self::folder_config_path(serve_root))?;
        Ok(global.merge(folder))
    }

    pub fn load_global() -> Result<Self> {
        Self::load_from(&Self::global_config_path())
    }

    pub fn load_from(path: &Path) -> Result<Self> {
        if !path.is_file() {
            return Ok(Self::default());
        }

        let contents = std::fs::read_to_string(path)
            .with_context(|| format!("read config {}", path.display()))?;
        toml::from_str(&contents).with_context(|| format!("parse config {}", path.display()))
    }

    pub fn save_to(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create config directory {}", parent.display()))?;
        }
        let contents = toml::to_string_pretty(self).context("serialize config")?;
        std::fs::write(path, contents).with_context(|| format!("write config {}", path.display()))
    }

    pub fn merge(mut self, overlay: Self) -> Self {
        if overlay.server.read_only.is_some() {
            self.server.read_only = overlay.server.read_only;
        }
        if overlay.server.open_browser.is_some() {
            self.server.open_browser = overlay.server.open_browser;
        }
        self
    }

    pub fn get(&self, key: &str) -> Result<Option<String>> {
        match key {
            "server.read_only" => Ok(Some(self.read_only().to_string())),
            "server.open_browser" => Ok(Some(self.open_browser().to_string())),
            _ => bail!("unknown config key {key}"),
        }
    }

    pub fn set(&mut self, key: &str, value: &str) -> Result<()> {
        match key {
            "server.read_only" => {
                self.server.read_only = Some(parse_bool(value)?);
            }
            "server.open_browser" => {
                self.server.open_browser = Some(parse_bool(value)?);
            }
            _ => bail!("unknown config key {key}"),
        }
        Ok(())
    }

    pub fn read_only(&self) -> bool {
        self.server.read_only.unwrap_or(false)
    }

    pub fn open_browser(&self) -> bool {
        self.server.open_browser.unwrap_or(true)
    }

    pub fn init_global() -> Result<PathBuf> {
        let config_path = Self::global_config_path();
        if !config_path.is_file() {
            Self::default().save_to(&config_path)?;
        }
        Ok(config_path)
    }

    pub fn init_folder(serve_root: &Path) -> Result<PathBuf> {
        let config_path = Self::folder_config_path(serve_root);
        if !config_path.is_file() {
            Self::default().save_to(&config_path)?;
        }
        Ok(config_path)
    }
}

fn parse_bool(value: &str) -> Result<bool> {
    match value {
        "true" | "1" | "yes" => Ok(true),
        "false" | "0" | "no" => Ok(false),
        _ => bail!("invalid boolean value {value:?}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn with_test_homes<F: FnOnce()>(base: PathBuf, f: F) {
        xdg::set_test_config_home(Some(base.join("config")));
        xdg::set_test_cache_home(Some(base.join("cache")));
        f();
        xdg::set_test_config_home(None);
        xdg::set_test_cache_home(None);
    }

    #[test]
    fn defaults_when_missing() {
        let dir = tempdir().unwrap();
        with_test_homes(dir.path().to_path_buf(), || {
            let root = dir.path().canonicalize().unwrap();
            let config = Config::load(&root).unwrap();
            assert!(!config.read_only());
            assert!(config.open_browser());
        });
    }

    #[test]
    fn folder_config_overrides_global() {
        let dir = tempdir().unwrap();
        with_test_homes(dir.path().to_path_buf(), || {
            let root = dir.path().canonicalize().unwrap();
            Config::default()
                .save_to(&Config::global_config_path())
                .unwrap();
            let mut folder = Config::default();
            folder.server.read_only = Some(true);
            folder
                .save_to(&Config::folder_config_path(&root))
                .unwrap();

            let config = Config::load(&root).unwrap();
            assert!(config.read_only());
            assert!(config.open_browser());
        });
    }

    #[test]
    fn init_global_creates_defaults() {
        let dir = tempdir().unwrap();
        with_test_homes(dir.path().to_path_buf(), || {
            let config_path = Config::init_global().unwrap();
            assert!(config_path.is_file());
            let config = Config::load_global().unwrap();
            assert!(!config.read_only());
        });
    }

    #[test]
    fn set_and_get_round_trip() {
        let mut config = Config::default();
        config.set("server.read_only", "true").unwrap();
        assert_eq!(config.get("server.read_only").unwrap(), Some("true".into()));
    }
}
