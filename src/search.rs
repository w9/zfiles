use std::path::{Path, PathBuf};
use std::process::Stdio;

use anyhow::{Context, Result, bail};
use clap::Parser;
use tokio::process::Command;

use crate::plugin::framing;
use crate::plugins::{PluginRecord, PluginSupervisor};

#[derive(Debug, Parser)]
pub struct SearchArgs {
    /// Directory to search
    pub folder: PathBuf,

    /// Filename query
    pub query: String,

    /// Subtree path relative to the folder
    #[arg(long, default_value = "")]
    pub path: String,
}

pub async fn run(args: SearchArgs) -> Result<()> {
    let root = std::fs::canonicalize(&args.folder)
        .with_context(|| format!("failed to resolve folder {}", args.folder.display()))?;
    let results = search_headless(root, &args.path, &args.query).await?;
    if results.is_empty() {
        println!("No matches.");
        return Ok(());
    }

    for entry in results {
        println!("{}\t{}", entry.path, entry.size);
    }
    Ok(())
}

pub async fn search_headless(
    serve_root: PathBuf,
    relative_path: &str,
    query: &str,
) -> Result<Vec<crate::fs::FileEntry>> {
    let supervisor = PluginSupervisor::new(serve_root.clone());
    let plugins = supervisor.discover()?;
    let record = plugins
        .into_iter()
        .find(|plugin| {
            plugin
                .manifest
                .capabilities
                .iter()
                .any(|cap| cap == "searcher")
        })
        .ok_or_else(|| anyhow::anyhow!("no searcher plugin installed"))?;

    query_searcher_plugin(&record, &serve_root, relative_path, query).await
}

async fn query_searcher_plugin(
    record: &PluginRecord,
    serve_root: &Path,
    relative_path: &str,
    query: &str,
) -> Result<Vec<crate::fs::FileEntry>> {
    ensure_plugin_dirs(&record.root)?;
    let executable = record.root.join(&record.manifest.executable);
    let mut child = Command::new(&executable)
        .current_dir(&record.root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .with_context(|| format!("spawn plugin {}", record.manifest.name))?;

    let mut stdin = child.stdin.take().context("plugin stdin")?;
    let mut stdout = child.stdout.take().context("plugin stdout")?;

    let init = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": record.manifest.protocol_version,
            "capabilities": record.manifest.capabilities,
            "globs": record.manifest.globs,
            "storagePath": record.root.join("data").display().to_string(),
            "rootPath": serve_root.display().to_string(),
        }
    });
    framing::write_message(&mut stdin, &init).await?;
    let init_response = framing::read_message(&mut stdout).await?;
    if init_response.get("error").is_some() {
        bail!("initialize failed: {init_response}");
    }

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "searcher/query",
        "params": { "path": relative_path, "query": query },
    });
    framing::write_message(&mut stdin, &request).await?;
    let response = framing::read_message(&mut stdout).await?;
    if response.get("error").is_some() {
        bail!("searcher/query failed: {response}");
    }

    parse_searcher_response(&response)
}

fn parse_searcher_response(response: &serde_json::Value) -> Result<Vec<crate::fs::FileEntry>> {
    let Some(entries) = response
        .get("result")
        .and_then(|value| value.get("entries"))
        .and_then(|value| value.as_array())
    else {
        return Ok(Vec::new());
    };

    let mut parsed = Vec::with_capacity(entries.len());
    for entry in entries {
        parsed.push(serde_json::from_value(entry.clone()).context("parse searcher entry")?);
    }
    Ok(parsed)
}

fn ensure_plugin_dirs(root: &Path) -> Result<()> {
    std::fs::create_dir_all(root.join("data")).context("create plugin data directory")?;
    std::fs::create_dir_all(root.join("logs")).context("create plugin logs directory")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn headless_search_finds_matching_file() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("notes.txt"), b"x").unwrap();
        std::fs::write(dir.path().join("other.bin"), b"x").unwrap();

        let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures/plugins/search-filename");
        PluginSupervisor::new(dir.path().to_path_buf())
            .install(&source)
            .unwrap();

        let results = search_headless(dir.path().to_path_buf(), "", "notes")
            .await
            .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "notes.txt");
    }
}
