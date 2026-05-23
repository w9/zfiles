use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    if env::var("CARGO_FEATURE_BUNDLED_PLUGINS").is_err() {
        return;
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let plugin_src = manifest_dir.join("plugins/image-thumbnailer");
    let bundled_root = manifest_dir.join("bundled/image-thumbnailer");

    for rel in [
        "manifest.toml",
        "viewer.js",
        "locales/en.json",
        "locales/zh-CN.json",
    ] {
        println!("cargo:rerun-if-changed={}", plugin_src.join(rel).display());
    }

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let target_dir = env::var("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| manifest_dir.join("target"));
    let binary = target_dir.join(&profile).join("image-thumbnailer");
    let binary = ensure_plugin_binary(&manifest_dir, &target_dir, &profile, binary);

    fs::create_dir_all(bundled_root.join("bin")).expect("create bundled bin directory");
    fs::create_dir_all(bundled_root.join("locales")).expect("create bundled locales directory");

    for rel in ["manifest.toml", "viewer.js"] {
        fs::copy(plugin_src.join(rel), bundled_root.join(rel))
            .unwrap_or_else(|error| panic!("copy bundled asset {rel}: {error}"));
    }

    for locale in ["en.json", "zh-CN.json"] {
        fs::copy(
            plugin_src.join("locales").join(locale),
            bundled_root.join("locales").join(locale),
        )
        .unwrap_or_else(|error| panic!("copy bundled locale {locale}: {error}"));
    }

    let bundled_binary = bundled_root.join("bin/image-thumbnailer");
    fs::copy(&binary, &bundled_binary)
        .unwrap_or_else(|error| panic!("copy bundled image-thumbnailer binary: {error}"));

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = fs::metadata(&bundled_binary)
            .expect("metadata bundled plugin binary")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&bundled_binary, permissions).expect("chmod bundled plugin binary");
    }
}

fn ensure_plugin_binary(
    manifest_dir: &Path,
    _target_dir: &Path,
    profile: &str,
    binary: PathBuf,
) -> PathBuf {
    if binary.is_file() {
        return binary;
    }

    if let Ok(path) = env::var("CARGO_BIN_EXE_image-thumbnailer") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return path;
        }
    }

    let cargo = env::var("CARGO").unwrap_or_else(|_| "cargo".into());
    let status = Command::new(cargo)
        .current_dir(manifest_dir)
        .args(["build", "-p", "image-thumbnailer", "--profile", profile])
        .status()
        .expect("spawn cargo build for image-thumbnailer");
    if !status.success() {
        panic!("failed to build image-thumbnailer for bundled plugins");
    }
    if !binary.is_file() {
        panic!(
            "image-thumbnailer binary missing at {} after build",
            binary.display()
        );
    }
    binary
}
