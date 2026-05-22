use std::path::{Path, PathBuf};

use crate::config::Config;

pub fn resolve(serve_root: &Path, config: &Config) -> PathBuf {
    config
        .state
        .dotfolder_path
        .clone()
        .unwrap_or_else(|| serve_root.join(".zfiles"))
}

pub fn resolve_for_root(serve_root: &Path) -> PathBuf {
    let bootstrap_path = serve_root.join(".zfiles/config.toml");
    if bootstrap_path.is_file() {
        let bootstrap = crate::config::Config::load_from(&bootstrap_path).unwrap_or_default();
        return resolve(serve_root, &bootstrap);
    }
    serve_root.join(".zfiles")
}

pub fn config_path(serve_root: &Path, config: &Config) -> PathBuf {
    resolve(serve_root, config).join("config.toml")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn defaults_to_serve_root_dotfolder() {
        let dir = tempdir().unwrap();
        let config = crate::config::Config::default();
        assert_eq!(
            resolve(dir.path(), &config),
            dir.path().join(".zfiles")
        );
    }

    #[test]
    fn honors_relocated_path() {
        let dir = tempdir().unwrap();
        let external = dir.path().join("state-store");
        let mut config = crate::config::Config::default();
        config.state.dotfolder_path = Some(external.clone());
        assert_eq!(resolve(dir.path(), &config), external);
    }
}
