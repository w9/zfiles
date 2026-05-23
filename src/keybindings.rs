use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct UserKeybinding {
    pub key: String,
    pub command: String,
    #[serde(default)]
    pub when: Option<String>,
    #[serde(default)]
    pub args: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
pub struct KeybindingsFile {
    #[serde(default, rename = "keybinding")]
    pub keybindings: Vec<UserKeybinding>,
}

pub fn config_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config/zfiles"))
}

pub fn keybindings_path() -> Option<PathBuf> {
    config_dir().map(|dir| dir.join("keybindings.toml"))
}

pub fn load_from_path(path: &Path) -> Result<KeybindingsFile> {
    if !path.is_file() {
        return Ok(KeybindingsFile::default());
    }
    let contents = std::fs::read_to_string(path)
        .with_context(|| format!("read keybindings {}", path.display()))?;
    toml::from_str(&contents).with_context(|| format!("parse keybindings {}", path.display()))
}

pub fn load_user_keybindings() -> KeybindingsFile {
    keybindings_path()
        .and_then(|path| load_from_path(&path).ok())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_keybindings_file() {
        let parsed: KeybindingsFile = toml::from_str(
            r#"
[[keybinding]]
key = "Mod+Shift+P"
command = "view.open-command-palette"

[[keybinding]]
key = "Mod+K"
command = "selection.clear"
when = "selection.count > 0"
args = { confirm = false }
"#,
        )
        .unwrap();
        assert_eq!(parsed.keybindings.len(), 2);
        assert_eq!(parsed.keybindings[0].command, "view.open-command-palette");
        assert_eq!(
            parsed.keybindings[1].args.get("confirm"),
            Some(&Value::Bool(false))
        );
    }

    #[test]
    fn missing_file_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("missing.toml");
        assert_eq!(load_from_path(&file).unwrap(), KeybindingsFile::default());
    }
}
