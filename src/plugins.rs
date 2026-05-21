use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use serde::Deserialize;
use tokio::process::{Child, Command};
use tracing::{info, warn};

use crate::events::{EventBus, KernelEvent};
use crate::plugin::framing;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub executable: String,
    pub protocol_version: u32,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub globs: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PluginRecord {
    pub manifest: PluginManifest,
    pub root: PathBuf,
}

#[derive(Default)]
pub struct PluginSupervisor {
    plugins: Mutex<Vec<PluginRecord>>,
    children: Mutex<Vec<Child>>,
}

impl PluginSupervisor {
    pub fn discover(&self, serve_root: &Path) -> Result<Vec<PluginRecord>> {
        let mut discovered = Vec::new();
        let mut seen = HashMap::new();

        let folder_plugins = serve_root.join(".zfiles/plugins");
        discover_in(&folder_plugins, &mut discovered, &mut seen)?;

        if let Some(home) = home_plugins_dir() {
            discover_in(&home, &mut discovered, &mut seen)?;
        }

        *self
            .plugins
            .lock()
            .map_err(|_| anyhow::anyhow!("plugin registry mutex poisoned"))? = discovered.clone();

        Ok(discovered)
    }

    pub fn start_background(
        self: Arc<Self>,
        serve_root: PathBuf,
        events: EventBus,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            if let Err(error) = self.run(serve_root, events).await {
                warn!(%error, "plugin supervisor exited");
            }
        })
    }

    async fn run(self: Arc<Self>, serve_root: PathBuf, events: EventBus) -> Result<()> {
        let plugins = self.discover(&serve_root)?;
        info!(count = plugins.len(), "discovered plugins");

        for plugin in plugins {
            if let Err(error) = self.spawn_plugin(&plugin, &events).await {
                warn!(plugin = %plugin.manifest.name, %error, "failed to start plugin");
            }
        }

        Ok(())
    }

    async fn spawn_plugin(&self, plugin: &PluginRecord, events: &EventBus) -> Result<()> {
        let executable = plugin.root.join(&plugin.manifest.executable);
        let mut command = Command::new(&executable);
        command
            .current_dir(&plugin.root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = command
            .spawn()
            .with_context(|| format!("spawn plugin {}", plugin.manifest.name))?;

        info!(plugin = %plugin.manifest.name, "plugin spawned");

        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": plugin.manifest.protocol_version,
                "capabilities": plugin.manifest.capabilities,
                "globs": plugin.manifest.globs,
            }
        });

        if let Some(stdin) = child.stdin.as_mut() {
            framing::write_message(stdin, &request).await?;
        }

        if let Some(stdout) = child.stdout.as_mut() {
            match framing::read_message(stdout).await {
                Ok(response) => {
                    info!(plugin = %plugin.manifest.name, ?response, "plugin handshake complete");
                    events.publish(KernelEvent::PluginReady {
                        name: plugin.manifest.name.clone(),
                    });
                }
                Err(error) => {
                    warn!(plugin = %plugin.manifest.name, %error, "plugin handshake failed");
                }
            }
        }

        self.children
            .lock()
            .map_err(|_| anyhow::anyhow!("plugin child mutex poisoned"))?
            .push(child);

        Ok(())
    }
}

fn discover_in(
    root: &Path,
    discovered: &mut Vec<PluginRecord>,
    seen: &mut HashMap<String, ()>,
) -> Result<()> {
    if !root.is_dir() {
        return Ok(());
    }

    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }

        let manifest_path = entry.path().join("manifest.toml");
        if !manifest_path.is_file() {
            continue;
        }

        let contents = std::fs::read_to_string(&manifest_path)?;
        let manifest: PluginManifest = toml::from_str(&contents)
            .with_context(|| format!("parse plugin manifest {}", manifest_path.display()))?;

        if seen.insert(manifest.name.clone(), ()).is_some() {
            continue;
        }

        discovered.push(PluginRecord {
            manifest,
            root: entry.path(),
        });
    }

    Ok(())
}

fn home_plugins_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config/zfiles/plugins"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_manifest() {
        let manifest: PluginManifest = toml::from_str(
            r#"
            name = "demo"
            version = "0.1.0"
            executable = "bin/demo"
            protocol_version = 1
            capabilities = ["lister"]
            globs = ["*.txt"]
            "#,
        )
        .unwrap();
        assert_eq!(manifest.name, "demo");
        assert_eq!(manifest.capabilities, vec!["lister".to_string()]);
    }
}
