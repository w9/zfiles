use std::path::PathBuf;

use anyhow::Context;
use clap::Parser;

use crate::config::Config;
use crate::dotfolder;
use crate::plugins::PluginSupervisor;

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
    let dotfolder = layout.dotfolder.clone();
    let plugins = PluginSupervisor::with_dotfolder(root.clone(), dotfolder.clone()).list()?;

    println!("root: {}", root.display());
    println!("dot-folder: {}", dotfolder.display());
    if dotfolder.is_dir() {
        println!("dot-folder-status: present");
    } else {
        println!("dot-folder-status: missing");
    }
    if layout.dotfolder_relocated {
        println!("dot-folder-relocated: true");
    }
    println!("read_only: {}", layout.read_only);
    println!("open_browser: {}", config.open_browser());
    println!("plugins: {}", plugins.len());
    for plugin in plugins {
        println!(
            "  - {} {} [{}]",
            plugin.manifest.name,
            plugin.manifest.version,
            plugin.manifest.capabilities.join(", ")
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn status_runs_for_empty_folder() {
        let dir = tempdir().unwrap();
        run(StatusArgs {
            path: dir.path().to_path_buf(),
        })
        .unwrap();
    }
}
