use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

use crate::dotfolder;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
pub struct Config {
    #[serde(default)]
    pub server: ServerConfig,
    #[serde(default)]
    pub state: StateConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
pub struct StateConfig {
    pub dotfolder_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
pub struct ServerConfig {
    pub read_only: Option<bool>,
    pub open_browser: Option<bool>,
}

impl Config {
    pub fn dotfolder_config(root: &Path) -> PathBuf {
        root.join(".zfiles/config.toml")
    }

    pub fn load(root: &Path) -> Result<Self> {
        let bootstrap_path = Self::dotfolder_config(root);
        if bootstrap_path.is_file() {
            let bootstrap = Self::load_from(&bootstrap_path)?;
            let dot = dotfolder::resolve(root, &bootstrap);
            let resolved_path = dot.join("config.toml");
            if resolved_path == bootstrap_path {
                return Ok(bootstrap);
            }
            if resolved_path.is_file() {
                return Self::load_from(&resolved_path);
            }
            return Ok(bootstrap);
        }
        Self::load_from(&dotfolder::resolve(root, &Self::default()).join("config.toml"))
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

    pub fn get(&self, key: &str) -> Result<Option<String>> {
        match key {
            "server.read_only" => Ok(Some(self.read_only().to_string())),
            "server.open_browser" => Ok(Some(self.open_browser().to_string())),
            "state.dotfolder_path" => Ok(self
                .state
                .dotfolder_path
                .as_ref()
                .map(|path| path.display().to_string())),
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
            "state.dotfolder_path" => {
                self.state.dotfolder_path = Some(PathBuf::from(value));
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

    pub fn init_folder(root: &Path) -> Result<PathBuf> {
        let config_path = Self::dotfolder_config(root);
        if !config_path.is_file() {
            std::fs::create_dir_all(
                config_path
                    .parent()
                    .context("config path must have a parent")?,
            )?;
            Self::default().save_to(&config_path)?;
        }
        let config = Self::load(root)?;
        let dotfolder = dotfolder::resolve(root, &config);
        std::fs::create_dir_all(dotfolder.join("plugins"))
            .context("create plugins directory")?;
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

    #[test]
    fn init_folder_creates_defaults() {
        let dir = tempdir().unwrap();
        let config_path = Config::init_folder(dir.path()).unwrap();
        assert!(config_path.is_file());
        assert!(dir.path().join(".zfiles/plugins").is_dir());
        let config = Config::load(dir.path()).unwrap();
        assert!(!config.read_only());
    }

    #[test]
    fn set_and_get_round_trip() {
        let mut config = Config::default();
        config.set("server.read_only", "true").unwrap();
        assert_eq!(config.get("server.read_only").unwrap(), Some("true".into()));
    }
}
