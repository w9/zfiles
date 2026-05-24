use std::env;
use std::fs;
use std::path::{Path, PathBuf};

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
    let target_triple = env::var("TARGET").unwrap_or_else(|_| env::var("HOST").expect("HOST"));
    let host = env::var("HOST").unwrap_or_else(|_| target_triple.clone());
    let target_dir = env::var("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| manifest_dir.join("target"));
    let binary = find_plugin_binary(&target_dir, &profile, &target_triple, &host);

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

/// Build scripts still receive PROFILE=`debug`/`release`; Cargo 1.95 rejects `--profile debug`.
fn cargo_build_profile(profile: &str) -> &str {
    match profile {
        "debug" => "dev",
        other => other,
    }
}

/// Dev/test artifacts live under `target/debug/` even though the profile is named `dev`.
fn target_subdir(profile: &str) -> &str {
    match profile {
        "dev" | "debug" | "test" => "debug",
        "bench" => "release",
        other => other,
    }
}

fn find_plugin_binary(
    target_dir: &Path,
    profile: &str,
    target_triple: &str,
    host: &str,
) -> PathBuf {
    for candidate in plugin_binary_candidates(target_dir, profile, target_triple, host) {
        if candidate.is_file() {
            return candidate;
        }
    }

    if let Ok(path) = env::var("CARGO_BIN_EXE_image-thumbnailer") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return path;
        }
    }

    panic!(
        "image-thumbnailer binary not found; run `cargo build -p image-thumbnailer --profile {}` first",
        cargo_build_profile(profile)
    );
}

fn plugin_binary_candidates(
    target_dir: &Path,
    profile: &str,
    target_triple: &str,
    host: &str,
) -> Vec<PathBuf> {
    let subdir = target_subdir(profile);
    let mut candidates = Vec::new();
    if target_triple == host {
        candidates.push(target_dir.join(subdir).join("image-thumbnailer"));
    }
    candidates.push(
        target_dir
            .join(target_triple)
            .join(subdir)
            .join("image-thumbnailer"),
    );
    if target_triple != host {
        candidates.push(target_dir.join(subdir).join("image-thumbnailer"));
    }
    candidates
}
