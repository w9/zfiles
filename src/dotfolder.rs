use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use crate::config::Config;
use crate::writable;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServeLayout {
    pub dotfolder: PathBuf,
    pub read_only: bool,
    pub dotfolder_relocated: bool,
    pub auto_read_only: bool,
}

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

pub fn config_base_dir() -> PathBuf {
    test_config_base()
        .unwrap_or_else(default_config_base_dir)
}

fn default_config_base_dir() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
        .unwrap_or_else(|| PathBuf::from(".config"))
        .join("zfiles")
}

#[cfg(debug_assertions)]
fn test_config_base() -> Option<PathBuf> {
    use std::sync::{Mutex, OnceLock};

    static SLOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
}

#[cfg(not(debug_assertions))]
fn test_config_base() -> Option<PathBuf> {
    None
}

#[cfg(debug_assertions)]
pub fn set_test_config_base(dir: Option<PathBuf>) {
    use std::sync::{Mutex, OnceLock};

    static SLOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    if let Ok(mut guard) = SLOT
        .get_or_init(|| Mutex::new(None))
        .lock()
    {
        *guard = dir;
    }
}

pub fn fallback_dotfolder(serve_root: &Path) -> PathBuf {
    config_base_dir()
        .join("dotfolders")
        .join(serve_folder_id(serve_root))
}

pub fn plan_serve_layout(serve_root: &Path, config: &Config, cli_read_only: bool) -> ServeLayout {
    let serve_root_writable = writable::is_writable(serve_root);
    let auto_read_only = !serve_root_writable && !cli_read_only && !config.read_only();
    let read_only = cli_read_only || config.read_only() || !serve_root_writable;

    let preferred = resolve(serve_root, config);
    let explicit_dotfolder = config.state.dotfolder_path.is_some();

    if writable::is_writable(&preferred) {
        return ServeLayout {
            dotfolder: preferred,
            read_only,
            dotfolder_relocated: false,
            auto_read_only,
        };
    }

    if explicit_dotfolder {
        let fallback = fallback_dotfolder(serve_root);
        return ServeLayout {
            dotfolder: fallback,
            read_only,
            dotfolder_relocated: true,
            auto_read_only,
        };
    }

    if serve_root_writable {
        return ServeLayout {
            dotfolder: preferred,
            read_only,
            dotfolder_relocated: false,
            auto_read_only,
        };
    }

    ServeLayout {
        dotfolder: fallback_dotfolder(serve_root),
        read_only,
        dotfolder_relocated: true,
        auto_read_only,
    }
}

fn serve_folder_id(serve_root: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    serve_root.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn with_test_config_base<F: FnOnce()>(base: PathBuf, f: F) {
        set_test_config_base(Some(base));
        f();
        set_test_config_base(None);
    }

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

    #[test]
    fn writable_root_uses_in_tree_dotfolder() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let config = Config::default();
        let layout = plan_serve_layout(&root, &config, false);
        assert_eq!(layout.dotfolder, root.join(".zfiles"));
        assert!(!layout.read_only);
        assert!(!layout.dotfolder_relocated);
        assert!(!layout.auto_read_only);
    }

    #[test]
    #[cfg(unix)]
    fn read_only_root_auto_enables_read_only_and_relocates_state() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("notes.txt"), b"hello").unwrap();
        let root = dir.path().canonicalize().unwrap();
        let metadata = std::fs::metadata(&root).unwrap();
        let mut permissions = metadata.permissions();
        permissions.set_mode(metadata.permissions().mode() & !0o222);
        std::fs::set_permissions(&root, permissions).unwrap();

        with_test_config_base(dir.path().join("xdg-config").join("zfiles"), || {
            let layout = plan_serve_layout(&root, &Config::default(), false);
            assert!(layout.read_only);
            assert!(layout.auto_read_only);
            assert!(layout.dotfolder_relocated);
            assert!(layout.dotfolder.starts_with(config_base_dir()));
            assert_ne!(layout.dotfolder, root.join(".zfiles"));
        });
    }

    #[test]
    #[cfg(unix)]
    fn explicit_dotfolder_path_falls_back_when_not_writable() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let external = dir.path().join("external-dotfolder");
        std::fs::create_dir_all(&external).unwrap();
        let metadata = std::fs::metadata(&external).unwrap();
        let mut permissions = metadata.permissions();
        permissions.set_mode(metadata.permissions().mode() & !0o222);
        std::fs::set_permissions(&external, permissions).unwrap();

        let mut config = Config::default();
        config.state.dotfolder_path = Some(external);

        with_test_config_base(dir.path().join("xdg-config").join("zfiles"), || {
            let layout = plan_serve_layout(&root, &config, false);
            assert!(layout.dotfolder_relocated);
            assert!(layout.dotfolder.starts_with(config_base_dir()));
        });
    }
}
