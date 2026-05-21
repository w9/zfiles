use std::path::Path;
use std::process::Stdio;

use anyhow::{Context, Result, bail};
use tokio::process::Command;

use crate::plugin::framing;
use crate::plugins::PluginManifest;

pub async fn run(plugin_root: &Path) -> Result<()> {
    let manifest_path = plugin_root.join("manifest.toml");
    let contents = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("read {}", manifest_path.display()))?;
    let manifest: PluginManifest =
        toml::from_str(&contents).context("parse plugin manifest")?;

    let executable = plugin_root.join(&manifest.executable);
    if manifest.capabilities.iter().any(|cap| cap == "viewer") {
        std::fs::write(plugin_root.join("notes.txt"), b"hello")?;
    }
    let mut child = Command::new(&executable)
        .current_dir(plugin_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .with_context(|| format!("spawn plugin {}", executable.display()))?;

    let mut stdin = child.stdin.take().context("plugin stdin")?;
    let mut stdout = child.stdout.take().context("plugin stdout")?;

    let init = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": manifest.protocol_version,
            "capabilities": manifest.capabilities,
            "globs": manifest.globs,
            "rootPath": plugin_root.display().to_string(),
        }
    });

    framing::write_message(&mut stdin, &init).await?;
    let response = framing::read_message(&mut stdout).await?;
    if response.get("error").is_some() {
        bail!("initialize failed: {response}");
    }

    if manifest.capabilities.iter().any(|cap| cap == "lister") {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "lister/enrich",
            "params": {
                "path": "",
                "entries": [{
                    "name": "notes.txt",
                    "path": "notes.txt",
                    "is_dir": false,
                    "size": 5
                }]
            }
        });
        framing::write_message(&mut stdin, &request).await?;
        let enriched = framing::read_message(&mut stdout).await?;
        if enriched.get("error").is_some() {
            bail!("lister/enrich failed: {enriched}");
        }
    }

    if manifest.capabilities.iter().any(|cap| cap == "searcher") {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "searcher/query",
            "params": {
                "path": "",
                "query": "notes",
            }
        });
        framing::write_message(&mut stdin, &request).await?;
        let searched = framing::read_message(&mut stdout).await?;
        if searched.get("error").is_some() {
            bail!("searcher/query failed: {searched}");
        }
    }

    if manifest.capabilities.iter().any(|cap| cap == "thumbnailer") {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "thumbnailer/generate",
            "params": { "path": "photo.jpg" },
        });
        framing::write_message(&mut stdin, &request).await?;
        let thumb = framing::read_message(&mut stdout).await?;
        if thumb.get("error").is_some() {
            bail!("thumbnailer/generate failed: {thumb}");
        }
    }

    if manifest.capabilities.iter().any(|cap| cap == "viewer") {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "viewer/preview",
            "params": { "path": "notes.txt" },
        });
        framing::write_message(&mut stdin, &request).await?;
        let preview = framing::read_message(&mut stdout).await?;
        if preview.get("error").is_some() {
            bail!("viewer/preview failed: {preview}");
        }
    }

    drop(stdin);
    let status = child.wait().await.context("wait for plugin")?;
    if !status.success() {
        bail!("plugin exited with {status}");
    }

    Ok(())
}
