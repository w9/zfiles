use std::path::{Path, PathBuf};

use crate::config::Config;
use crate::writable;
use crate::xdg;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServeLayout {
    pub state_dir: PathBuf,
    pub serve_id: String,
    pub read_only: bool,
    pub auto_read_only: bool,
}

pub fn state_dir(serve_root: &Path) -> PathBuf {
    xdg::folder_dir(serve_root)
}

pub fn resolve_for_root(serve_root: &Path) -> PathBuf {
    state_dir(serve_root)
}

pub fn config_path(serve_root: &Path) -> PathBuf {
    xdg::folder_config_path(serve_root)
}

pub fn config_base_dir() -> PathBuf {
    xdg::config_home()
}

#[cfg(debug_assertions)]
pub fn set_test_config_base(dir: Option<PathBuf>) {
    xdg::set_test_config_home(dir);
}

pub fn plan_serve_layout(serve_root: &Path, config: &Config, cli_read_only: bool) -> ServeLayout {
    let serve_root_writable = writable::is_writable(serve_root);
    let auto_read_only = !serve_root_writable && !cli_read_only && !config.read_only();
    let read_only = cli_read_only || config.read_only() || !serve_root_writable;

    ServeLayout {
        serve_id: xdg::serve_id(serve_root),
        state_dir: state_dir(serve_root),
        read_only,
        auto_read_only,
    }
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
    fn always_uses_xdg_folder_state_dir() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        with_test_config_base(dir.path().join("xdg-config").join("zfiles"), || {
            let layout = plan_serve_layout(&root, &Config::default(), false);
            assert_eq!(layout.state_dir, xdg::folder_dir(&root));
            assert!(layout.state_dir.starts_with(xdg::config_home()));
            assert!(!layout.read_only);
            assert!(!layout.auto_read_only);
        });
    }

    #[test]
    #[cfg(unix)]
    fn read_only_root_auto_enables_read_only() {
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
            assert!(layout.state_dir.starts_with(xdg::config_home()));
        });
    }
}
