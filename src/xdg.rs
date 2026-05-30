use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

pub fn config_home() -> PathBuf {
    test_config_home().unwrap_or_else(default_config_home)
}

fn default_config_home() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
        .unwrap_or_else(|| PathBuf::from(".config"))
        .join("zfiles")
}

pub fn cache_home() -> PathBuf {
    test_cache_home().unwrap_or_else(default_cache_home)
}

fn default_cache_home() -> PathBuf {
    std::env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")))
        .unwrap_or_else(|| PathBuf::from(".cache"))
        .join("zfiles")
}

pub fn global_config_path() -> PathBuf {
    config_home().join("config.toml")
}

pub fn folder_dir(serve_root: &Path) -> PathBuf {
    config_home().join("folders").join(serve_id(serve_root))
}

pub fn folder_config_path(serve_root: &Path) -> PathBuf {
    folder_dir(serve_root).join("config.toml")
}

pub fn serve_id(serve_root: &Path) -> String {
    let canonical = canonical_serve_root(serve_root);
    let mut hasher = DefaultHasher::new();
    canonical.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn canonical_serve_root(serve_root: &Path) -> PathBuf {
    std::fs::canonicalize(serve_root).unwrap_or_else(|_| serve_root.to_path_buf())
}

#[cfg(debug_assertions)]
mod test_paths {
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    fn config_slot() -> &'static Mutex<Option<PathBuf>> {
        static SLOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
        SLOT.get_or_init(|| Mutex::new(None))
    }

    fn cache_slot() -> &'static Mutex<Option<PathBuf>> {
        static SLOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
        SLOT.get_or_init(|| Mutex::new(None))
    }

    pub fn config_home() -> Option<PathBuf> {
        config_slot().lock().ok()?.clone()
    }

    pub fn set_config_home(dir: Option<PathBuf>) {
        if let Ok(mut slot) = config_slot().lock() {
            *slot = dir;
        }
    }

    pub fn cache_home() -> Option<PathBuf> {
        cache_slot().lock().ok()?.clone()
    }

    pub fn set_cache_home(dir: Option<PathBuf>) {
        if let Ok(mut slot) = cache_slot().lock() {
            *slot = dir;
        }
    }
}

#[cfg(debug_assertions)]
fn test_config_home() -> Option<PathBuf> {
    test_paths::config_home()
}

#[cfg(not(debug_assertions))]
fn test_config_home() -> Option<PathBuf> {
    None
}

#[cfg(debug_assertions)]
pub fn set_test_config_home(dir: Option<PathBuf>) {
    test_paths::set_config_home(dir);
}

#[cfg(not(debug_assertions))]
pub fn set_test_config_home(_dir: Option<PathBuf>) {}

#[cfg(debug_assertions)]
fn test_cache_home() -> Option<PathBuf> {
    test_paths::cache_home()
}

#[cfg(not(debug_assertions))]
fn test_cache_home() -> Option<PathBuf> {
    None
}

#[cfg(debug_assertions)]
pub fn set_test_cache_home(dir: Option<PathBuf>) {
    test_paths::set_cache_home(dir);
}

#[cfg(not(debug_assertions))]
pub fn set_test_cache_home(_dir: Option<PathBuf>) {}

#[cfg(debug_assertions)]
static TEST_HOMES_GUARD: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(debug_assertions)]
fn lock_test_homes() -> std::sync::MutexGuard<'static, ()> {
    TEST_HOMES_GUARD
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

#[cfg(debug_assertions)]
pub fn with_test_homes<F: FnOnce()>(base: PathBuf, f: F) {
    let _guard = lock_test_homes();
    set_test_config_home(Some(base.join("config")));
    set_test_cache_home(Some(base.join("cache")));
    f();
    set_test_config_home(None);
    set_test_cache_home(None);
}

#[cfg(not(debug_assertions))]
pub fn with_test_homes<F: FnOnce()>(_base: PathBuf, f: F) {
    f();
}

#[cfg(debug_assertions)]
pub fn with_test_config_home<F: FnOnce()>(config_home: PathBuf, f: F) {
    let _guard = lock_test_homes();
    set_test_config_home(Some(config_home));
    f();
    set_test_config_home(None);
}

#[cfg(not(debug_assertions))]
pub fn with_test_config_home<F: FnOnce()>(_config_home: PathBuf, f: F) {
    f();
}

#[cfg(debug_assertions)]
pub struct TestHomes {
    _guard: std::sync::MutexGuard<'static, ()>,
}

#[cfg(debug_assertions)]
impl TestHomes {
    pub fn new(base: PathBuf) -> Self {
        let guard = lock_test_homes();
        set_test_config_home(Some(base.join("config")));
        set_test_cache_home(Some(base.join("cache")));
        Self { _guard: guard }
    }
}

#[cfg(debug_assertions)]
impl Drop for TestHomes {
    fn drop(&mut self) {
        set_test_config_home(None);
        set_test_cache_home(None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn serve_id_is_stable_for_same_canonical_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        assert_eq!(serve_id(&root), serve_id(&root));
    }

    #[test]
    fn folder_paths_use_serve_id() {
        let dir = tempdir().unwrap();
        with_test_homes(dir.path().to_path_buf(), || {
            let root = dir.path().canonicalize().unwrap();
            let id = serve_id(&root);
            assert_eq!(
                folder_config_path(&root),
                dir.path()
                    .join("config/folders")
                    .join(id)
                    .join("config.toml")
            );
        });
    }
}
