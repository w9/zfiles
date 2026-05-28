use std::path::PathBuf;

use anyhow::Context;
use clap::Parser;

use crate::config::Config;
use crate::dotfolder;

#[derive(Debug, Parser)]
pub struct StatusArgs {
    /// Directory to inspect
    #[arg(default_value = ".")]
    pub path: PathBuf,
}

pub fn run(args: StatusArgs) -> anyhow::Result<()> {
    let root = std::fs::canonicalize(&args.path)
        .with_context(|| format!("failed to resolve path {}", args.path.display()))?;
    let config = Config::load(&root)?;
    let layout = dotfolder::plan_serve_layout(&root, &config, false);
    let state_dir = layout.state_dir.clone();

    println!("root: {}", root.display());
    println!("serve-id: {}", layout.serve_id);
    println!("state-dir: {}", state_dir.display());
    if state_dir.is_dir() {
        println!("state-dir-status: present");
    } else {
        println!("state-dir-status: missing");
    }
    println!(
        "folder-config: {}",
        Config::folder_config_path(&root).display()
    );
    println!("read_only: {}", layout.read_only);
    println!("open_browser: {}", config.open_browser());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::xdg;
    use tempfile::tempdir;

    fn with_test_homes<F: FnOnce()>(base: PathBuf, f: F) {
        xdg::set_test_config_home(Some(base.join("config")));
        xdg::set_test_cache_home(Some(base.join("cache")));
        f();
        xdg::set_test_config_home(None);
        xdg::set_test_cache_home(None);
    }

    #[test]
    fn status_runs_for_empty_folder() {
        let dir = tempdir().unwrap();
        with_test_homes(dir.path().to_path_buf(), || {
            run(StatusArgs {
                path: dir.path().to_path_buf(),
            })
            .unwrap();
        });
    }
}
