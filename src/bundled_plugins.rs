use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rust_embed::Embed;

use crate::plugins::{PluginManifest, PluginRecord};

const PLUGIN_NAME: &str = "image-thumbnailer";
const PLUGIN_PREFIX: &str = "image-thumbnailer/";

#[derive(Embed)]
#[folder = "bundled/"]
struct BundledAssets;

pub fn discover_bundled(
    discovered: &mut Vec<PluginRecord>,
    seen: &mut HashMap<String, ()>,
) -> Result<()> {
    if seen.contains_key(PLUGIN_NAME) {
        return Ok(());
    }

    let root = materialize_image_thumbnailer()?;
    let manifest_path = root.join("manifest.toml");
    let contents = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("read bundled plugin manifest {}", manifest_path.display()))?;
    let manifest: PluginManifest =
        toml::from_str(&contents).context("parse bundled image-thumbnailer manifest")?;

    seen.insert(manifest.name.clone(), ());
    discovered.push(PluginRecord { manifest, root });
    Ok(())
}

pub fn materialize_image_thumbnailer() -> Result<PathBuf> {
    let manifest = BundledAssets::get("image-thumbnailer/manifest.toml")
        .context("bundled image-thumbnailer manifest missing; rebuild with bundled-plugins enabled")?;
    let parsed: PluginManifest = toml::from_str(std::str::from_utf8(&manifest.data)?)?;
    let dest = cache_base_dir()
        .join(PLUGIN_NAME)
        .join(&parsed.version);

    if is_materialized(&dest) {
        return Ok(dest);
    }

    if dest.exists() {
        std::fs::remove_dir_all(&dest).with_context(|| format!("replace {}", dest.display()))?;
    }
    std::fs::create_dir_all(&dest)?;

    for path in BundledAssets::iter() {
        if !path.starts_with(PLUGIN_PREFIX) {
            continue;
        }
        let relative = path
            .strip_prefix(PLUGIN_PREFIX)
            .context("strip bundled plugin prefix")?;
        let asset = BundledAssets::get(path.as_ref()).with_context(|| format!("read {path}"))?;
        let out = dest.join(relative);
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&out, asset.data.as_ref())?;
        if relative == "bin/image-thumbnailer" {
            set_executable(&out)?;
        }
    }

    if !is_materialized(&dest) {
        anyhow::bail!("failed to materialize bundled image-thumbnailer");
    }

    Ok(dest)
}

fn is_materialized(dest: &Path) -> bool {
    dest.join("manifest.toml").is_file() && dest.join("bin/image-thumbnailer").is_file()
}

fn set_executable(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = std::fs::metadata(path)?.permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(path, permissions)?;
    }
    Ok(())
}

pub fn cache_base_dir() -> PathBuf {
    test_cache_base().unwrap_or_else(default_cache_base_dir)
}

fn default_cache_base_dir() -> PathBuf {
    std::env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache"))
        })
        .unwrap_or_else(|| PathBuf::from(".cache"))
        .join("zfiles/bundled")
}

#[cfg(debug_assertions)]
fn test_cache_base() -> Option<PathBuf> {
    use std::sync::{Mutex, OnceLock};

    static SLOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
}

#[cfg(not(debug_assertions))]
fn test_cache_base() -> Option<PathBuf> {
    None
}

#[cfg(debug_assertions)]
pub fn set_test_cache_base(dir: Option<PathBuf>) {
    use std::sync::{Mutex, OnceLock};

    static SLOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    if let Ok(mut guard) = SLOT.get_or_init(|| Mutex::new(None)).lock() {
        *guard = dir;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn materialize_image_thumbnailer_is_idempotent() {
        let dir = tempdir().unwrap();
        set_test_cache_base(Some(dir.path().join("cache")));

        let first = materialize_image_thumbnailer().expect("first materialize");
        let second = materialize_image_thumbnailer().expect("second materialize");
        assert_eq!(first, second);
        assert!(first.join("viewer.js").is_file());
        assert!(first.join("bin/image-thumbnailer").is_file());

        set_test_cache_base(None);
    }
}
