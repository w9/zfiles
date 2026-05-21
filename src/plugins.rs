use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;
use tracing::{info, warn};

use crate::events::{EventBus, KernelEvent};
use crate::fs::FileEntry;
use crate::plugin::framing;

const LISTER_TIMEOUT: Duration = Duration::from_millis(50);
const SEARCHER_TIMEOUT: Duration = Duration::from_millis(500);
const THUMBNAILER_TIMEOUT: Duration = Duration::from_millis(500);
const VIEWER_TIMEOUT: Duration = Duration::from_millis(500);
const ACTION_TIMEOUT: Duration = Duration::from_millis(200);
const INITIAL_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(30);

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
    #[serde(default)]
    pub viewer_module: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActionItem {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone)]
pub struct PluginRecord {
    pub manifest: PluginManifest,
    pub root: PathBuf,
}

#[derive(Clone)]
pub struct PluginSupervisor {
    inner: Arc<Inner>,
}

struct Inner {
    serve_root: PathBuf,
    handles: Mutex<HashMap<String, Arc<PluginHandle>>>,
}

struct PluginHandle {
    record: PluginRecord,
    serve_root: PathBuf,
    io: AsyncMutex<Option<PluginIo>>,
    ready: AtomicBool,
}

struct PluginIo {
    stdin: tokio::process::ChildStdin,
    stdout: tokio::process::ChildStdout,
    next_id: AtomicU64,
}

impl PluginSupervisor {
    pub fn new(serve_root: PathBuf) -> Self {
        Self {
            inner: Arc::new(Inner {
                serve_root,
                handles: Mutex::new(HashMap::new()),
            }),
        }
    }

    pub fn discover(&self) -> Result<Vec<PluginRecord>> {
        let mut discovered = Vec::new();
        let mut seen = HashMap::new();

        let folder_plugins = self.inner.serve_root.join(".zfiles/plugins");
        discover_in(&folder_plugins, &mut discovered, &mut seen)?;

        if let Some(home) = home_plugins_dir() {
            discover_in(&home, &mut discovered, &mut seen)?;
        }

        Ok(discovered)
    }

    pub fn list(&self) -> Result<Vec<PluginRecord>> {
        self.discover()
    }

    pub fn install(&self, source: &Path) -> Result<PluginRecord> {
        let manifest_path = source.join("manifest.toml");
        let contents = std::fs::read_to_string(&manifest_path)
            .with_context(|| format!("read {}", manifest_path.display()))?;
        let manifest: PluginManifest =
            toml::from_str(&contents).context("parse plugin manifest")?;

        let dest = self
            .inner
            .serve_root
            .join(".zfiles/plugins")
            .join(&manifest.name);
        if dest.exists() {
            std::fs::remove_dir_all(&dest).with_context(|| format!("replace {}", dest.display()))?;
        }
        copy_dir_recursive(source, &dest)?;

        Ok(PluginRecord {
            manifest,
            root: dest,
        })
    }

    pub fn remove(&self, name: &str) -> Result<()> {
        let dest = self
            .inner
            .serve_root
            .join(".zfiles/plugins")
            .join(name);
        if !dest.is_dir() {
            bail!("plugin {name} is not installed");
        }
        std::fs::remove_dir_all(&dest)
            .with_context(|| format!("remove plugin {}", dest.display()))
    }

    pub fn start_background(self: Arc<Self>, events: EventBus) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            match self.discover() {
                Ok(plugins) => {
                    info!(count = plugins.len(), "discovered plugins");
                    for plugin in plugins {
                        self.register_handle(&plugin);
                        let supervisor = Arc::clone(&self);
                        let events = events.clone();
                        tokio::spawn(async move {
                            supervisor.run_plugin_loop(plugin, events).await;
                        });
                    }
                }
                Err(error) => warn!(%error, "plugin discovery failed"),
            }
        })
    }

    pub async fn search(&self, path: &str, query: &str) -> Option<Vec<FileEntry>> {
        let handle = self.ready_searcher()?;
        let plugin_name = handle.record.manifest.name.clone();
        let call = handle.call_searcher(path, query);

        match tokio::time::timeout(SEARCHER_TIMEOUT, call).await {
            Ok(Ok(results)) => Some(results),
            Ok(Err(error)) => {
                warn!(plugin = %plugin_name, %error, "searcher call failed");
                None
            }
            Err(_) => {
                warn!(plugin = %plugin_name, "searcher call timed out");
                None
            }
        }
    }

    pub fn has_searcher(&self) -> bool {
        self.ready_searcher().is_some()
    }

    pub fn has_thumbnailer(&self) -> bool {
        self.ready_plugin_for("thumbnailer", "").is_some()
    }

    pub async fn thumbnail(&self, path: &str) -> Option<(String, Vec<u8>)> {
        let handle = self.ready_plugin_for("thumbnailer", path)?;
        let plugin_name = handle.record.manifest.name.clone();
        let call = handle.call_thumbnailer(path);
        match tokio::time::timeout(THUMBNAILER_TIMEOUT, call).await {
            Ok(Ok(result)) => Some(result),
            Ok(Err(error)) => {
                warn!(plugin = %plugin_name, %error, "thumbnailer call failed");
                None
            }
            Err(_) => {
                warn!(plugin = %plugin_name, "thumbnailer call timed out");
                None
            }
        }
    }

    pub async fn preview(&self, path: &str) -> Option<(String, String)> {
        let handle = self.ready_plugin_for("viewer", path)?;
        let plugin_name = handle.record.manifest.name.clone();
        let call = handle.call_viewer(path);
        match tokio::time::timeout(VIEWER_TIMEOUT, call).await {
            Ok(Ok(result)) => Some(result),
            Ok(Err(error)) => {
                warn!(plugin = %plugin_name, %error, "viewer call failed");
                None
            }
            Err(_) => {
                warn!(plugin = %plugin_name, "viewer call timed out");
                None
            }
        }
    }

    pub fn ready_plugins(&self) -> Vec<serde_json::Value> {
        let Ok(handles) = self.inner.handles.lock() else {
            return Vec::new();
        };

        handles
            .values()
            .filter(|handle| handle.ready.load(Ordering::SeqCst))
            .map(|handle| {
                serde_json::json!({
                    "name": handle.record.manifest.name,
                    "capabilities": handle.record.manifest.capabilities,
                    "globs": handle.record.manifest.globs,
                    "viewerModule": handle.record.manifest.viewer_module,
                })
            })
            .collect()
    }

    pub fn prefetch_thumbnails(&self, entries: &[FileEntry], events: EventBus) {
        for entry in entries {
            if entry.is_dir {
                continue;
            }
            if self.ready_plugin_for("thumbnailer", &entry.path).is_none() {
                continue;
            }
            let path = entry.path.clone();
            let supervisor = self.clone();
            let events = events.clone();
            tokio::spawn(async move {
                if supervisor.thumbnail(&path).await.is_some() {
                    events.publish(KernelEvent::ThumbnailReady {
                        path: path.clone(),
                        url: format!("/api/thumbnail?path={}", encode_query_path(&path)),
                    });
                }
            });
        }
    }

    pub async fn run_action(&self, path: &str, action_id: &str) -> Result<()> {
        let Some(handle) = self.ready_plugin_for("action", path) else {
            anyhow::bail!("action unavailable");
        };
        let plugin_name = handle.record.manifest.name.clone();
        let call = handle.call_action_run(path, action_id);
        match tokio::time::timeout(ACTION_TIMEOUT, call).await {
            Ok(Ok(())) => Ok(()),
            Ok(Err(error)) => {
                warn!(plugin = %plugin_name, %error, "action/run call failed");
                Err(error)
            }
            Err(_) => {
                warn!(plugin = %plugin_name, "action/run call timed out");
                anyhow::bail!("action timed out");
            }
        }
    }

    pub fn resolve_plugin_asset(&self, name: &str, relative: &str) -> Result<PathBuf> {
        let root = self
            .discover()?
            .into_iter()
            .find(|record| record.manifest.name == name)
            .map(|record| record.root)
            .with_context(|| format!("plugin {name} not found"))?;

        let root = std::fs::canonicalize(&root)
            .with_context(|| format!("resolve plugin root {}", root.display()))?;
        let relative = normalize_plugin_path(relative)?;
        let candidate = root.join(&relative);
        let canonical = std::fs::canonicalize(&candidate)
            .with_context(|| format!("plugin asset {} not found", candidate.display()))?;

        if !canonical.starts_with(&root) {
            anyhow::bail!("path escapes plugin directory");
        }
        if !canonical.is_file() {
            anyhow::bail!("plugin asset is not a file");
        }

        Ok(canonical)
    }

    pub async fn actions(&self, path: &str) -> Vec<ActionItem> {
        let Some(handle) = self.ready_plugin_for("action", path) else {
            return Vec::new();
        };
        let plugin_name = handle.record.manifest.name.clone();
        let call = handle.call_action_list(path);
        match tokio::time::timeout(ACTION_TIMEOUT, call).await {
            Ok(Ok(actions)) => actions,
            Ok(Err(error)) => {
                warn!(plugin = %plugin_name, %error, "action/list call failed");
                Vec::new()
            }
            Err(_) => {
                warn!(plugin = %plugin_name, "action/list call timed out");
                Vec::new()
            }
        }
    }

    pub async fn enrich_listing(
        &self,
        path: &str,
        entries: Vec<FileEntry>,
        events: EventBus,
    ) -> Vec<FileEntry> {
        let Some(handle) = self.ready_lister() else {
            return entries;
        };

        let plugin_name = handle.record.manifest.name.clone();
        let call = handle.call_lister(path, &entries);

        match tokio::time::timeout(LISTER_TIMEOUT, call).await {
            Ok(Ok(updated)) => updated,
            Ok(Err(error)) => {
                warn!(plugin = %plugin_name, %error, "lister call failed");
                entries
            }
            Err(_) => {
                let supervisor = self.clone();
                let path = path.to_string();
                let entries_for_task = entries.clone();
                tokio::spawn(async move {
                    if let Some(handle) = supervisor.ready_lister() {
                        match handle.call_lister(&path, &entries_for_task).await {
                            Ok(updated) => events.publish(KernelEvent::ListingEnrichment {
                                path,
                                entries: updated,
                            }),
                            Err(error) => {
                                warn!(plugin = %handle.record.manifest.name, %error, "async lister failed")
                            }
                        }
                    }
                });
                entries
            }
        }
    }

    fn register_handle(&self, record: &PluginRecord) {
        let handle = Arc::new(PluginHandle {
            record: record.clone(),
            serve_root: self.inner.serve_root.clone(),
            io: AsyncMutex::new(None),
            ready: AtomicBool::new(false),
        });
        if let Ok(mut handles) = self.inner.handles.lock() {
            handles.insert(record.manifest.name.clone(), handle);
        }
    }

    fn ready_searcher(&self) -> Option<Arc<PluginHandle>> {
        let handles = self.inner.handles.lock().ok()?;
        handles.values().find(|handle| {
            handle.ready.load(Ordering::SeqCst)
                && handle
                    .record
                    .manifest
                    .capabilities
                    .iter()
                    .any(|cap| cap == "searcher")
        }).cloned()
    }

    fn ready_lister(&self) -> Option<Arc<PluginHandle>> {
        let handles = self.inner.handles.lock().ok()?;
        handles.values().find(|handle| {
            handle.ready.load(Ordering::SeqCst)
                && handle
                    .record
                    .manifest
                    .capabilities
                    .iter()
                    .any(|cap| cap == "lister")
        }).cloned()
    }

    fn ready_plugin_for(&self, capability: &str, path: &str) -> Option<Arc<PluginHandle>> {
        let handles = self.inner.handles.lock().ok()?;
        handles.values().find(|handle| {
            handle.ready.load(Ordering::SeqCst)
                && handle
                    .record
                    .manifest
                    .capabilities
                    .iter()
                    .any(|cap| cap == capability)
                && (path.is_empty()
                    || crate::glob_match::matches_any(&handle.record.manifest.globs, path))
        }).cloned()
    }

    async fn run_plugin_loop(self: Arc<Self>, record: PluginRecord, events: EventBus) {
        let mut backoff = INITIAL_BACKOFF;
        loop {
            match self.run_plugin_once(&record, &events).await {
                Ok(()) => backoff = INITIAL_BACKOFF,
                Err(error) => warn!(plugin = %record.manifest.name, %error, "plugin exited"),
            }
            tokio::time::sleep(backoff).await;
            backoff = backoff.saturating_mul(2).min(MAX_BACKOFF);
        }
    }

    async fn run_plugin_once(&self, record: &PluginRecord, events: &EventBus) -> Result<()> {
        ensure_plugin_dirs(&record.root)?;
        let log_path = record
            .root
            .join("logs")
            .join(format!("{}.log", record.manifest.name));
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .with_context(|| format!("open plugin log {}", log_path.display()))?;

        let executable = record.root.join(&record.manifest.executable);
        let mut child = Command::new(&executable)
            .current_dir(&record.root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(log_file)
            .kill_on_drop(true)
            .spawn()
            .with_context(|| format!("spawn plugin {}", record.manifest.name))?;

        let stdin = child.stdin.take().context("plugin stdin")?;
        let stdout = child.stdout.take().context("plugin stdout")?;

        let handle = self
            .inner
            .handles
            .lock()
            .ok()
            .and_then(|map| map.get(&record.manifest.name).cloned());

        if let Some(handle) = &handle {
            *handle.io.lock().await = Some(PluginIo {
                stdin,
                stdout,
                next_id: AtomicU64::new(2),
            });
        }

        if let Some(handle) = &handle {
            if let Err(error) = handle.initialize().await {
                handle.ready.store(false, Ordering::SeqCst);
                return Err(error);
            }
            handle.ready.store(true, Ordering::SeqCst);
            events.publish(KernelEvent::PluginReady {
                name: record.manifest.name.clone(),
            });
        }

        let status = child.wait().await.context("wait for plugin")?;
        if let Some(handle) = &handle {
            handle.ready.store(false, Ordering::SeqCst);
            *handle.io.lock().await = None;
        }

        if !status.success() {
            anyhow::bail!("plugin exited with {status}");
        }

        Ok(())
    }
}
impl PluginHandle {
    async fn initialize(&self) -> Result<()> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": self.record.manifest.protocol_version,
                "capabilities": self.record.manifest.capabilities,
                "globs": self.record.manifest.globs,
                "storagePath": self.record.root.join("data").display().to_string(),
                "rootPath": self.serve_root.display().to_string(),
            }
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("initialize failed: {response}");
        }
        Ok(())
    }

    async fn call_searcher(&self, path: &str, query: &str) -> Result<Vec<FileEntry>> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request_id = io.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "searcher/query",
            "params": {
                "path": path,
                "query": query,
            }
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("searcher/query failed: {response}");
        }
        parse_searcher_response(&response)
    }

    async fn call_lister(&self, path: &str, entries: &[FileEntry]) -> Result<Vec<FileEntry>> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request_id = io.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "lister/enrich",
            "params": {
                "path": path,
                "entries": entries,
            }
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("lister/enrich failed: {response}");
        }
        merge_lister_response(entries, &response)
    }

    async fn call_thumbnailer(&self, path: &str) -> Result<(String, Vec<u8>)> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request_id = io.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "thumbnailer/generate",
            "params": { "path": path },
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("thumbnailer/generate failed: {response}");
        }
        parse_thumbnail_response(&response)
    }

    async fn call_action_run(&self, path: &str, action_id: &str) -> Result<()> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request_id = io.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "action/run",
            "params": { "path": path, "actionId": action_id },
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("action/run failed: {response}");
        }
        Ok(())
    }

    async fn call_action_list(&self, path: &str) -> Result<Vec<ActionItem>> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request_id = io.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "action/list",
            "params": { "path": path },
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("action/list failed: {response}");
        }
        parse_action_list_response(&response)
    }

    async fn call_viewer(&self, path: &str) -> Result<(String, String)> {
        let mut guard = self.io.lock().await;
        let io = guard.as_mut().context("plugin io unavailable")?;
        let request_id = io.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "viewer/preview",
            "params": { "path": path },
        });
        framing::write_message(&mut io.stdin, &request).await?;
        let response = framing::read_message(&mut io.stdout).await?;
        if response.get("error").is_some() {
            anyhow::bail!("viewer/preview failed: {response}");
        }
        parse_viewer_response(&response)
    }
}

fn normalize_plugin_path(path: &str) -> Result<PathBuf> {
    let path = Path::new(path.trim_start_matches('/'));
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir => anyhow::bail!("path escapes plugin directory"),
            Component::RootDir | Component::Prefix(_) => {
                anyhow::bail!("absolute plugin paths are not allowed")
            }
        }
    }
    Ok(normalized)
}

fn encode_query_path(path: &str) -> String {
    let mut encoded = String::with_capacity(path.len());
    for byte in path.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'/' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn parse_action_list_response(response: &Value) -> Result<Vec<ActionItem>> {
    let Some(actions) = response
        .get("result")
        .and_then(|value| value.get("actions"))
        .and_then(|value| value.as_array())
    else {
        return Ok(Vec::new());
    };

    let mut parsed = Vec::with_capacity(actions.len());
    for action in actions {
        let item: ActionItem = serde_json::from_value(action.clone()).context("parse action")?;
        parsed.push(item);
    }
    Ok(parsed)
}

fn parse_thumbnail_response(response: &Value) -> Result<(String, Vec<u8>)> {
    let result = response
        .get("result")
        .context("thumbnailer response missing result")?;
    let content_type = result
        .get("contentType")
        .and_then(Value::as_str)
        .unwrap_or("image/png")
        .to_string();
    let data = result
        .get("data")
        .and_then(Value::as_str)
        .context("thumbnailer response missing data")?;
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .context("decode thumbnail data")?;
    Ok((content_type, bytes))
}

fn parse_viewer_response(response: &Value) -> Result<(String, String)> {
    let result = response
        .get("result")
        .context("viewer response missing result")?;
    let content_type = result
        .get("contentType")
        .and_then(Value::as_str)
        .unwrap_or("text/plain")
        .to_string();
    let body = result
        .get("body")
        .and_then(Value::as_str)
        .context("viewer response missing body")?
        .to_string();
    Ok((content_type, body))
}

fn parse_searcher_response(response: &Value) -> Result<Vec<FileEntry>> {
    let Some(entries) = response
        .get("result")
        .and_then(|value| value.get("entries"))
        .and_then(|value| value.as_array())
    else {
        return Ok(Vec::new());
    };

    let mut parsed = Vec::with_capacity(entries.len());
    for entry in entries {
        let parsed_entry: FileEntry = serde_json::from_value(entry.clone())
            .context("parse searcher entry")?;
        parsed.push(parsed_entry);
    }
    Ok(parsed)
}

fn merge_lister_response(entries: &[FileEntry], response: &Value) -> Result<Vec<FileEntry>> {
    let Some(result_entries) = response
        .get("result")
        .and_then(|value| value.get("entries"))
        .and_then(|value| value.as_array())
    else {
        return Ok(entries.to_vec());
    };

    let mut merged = entries.to_vec();
    for updated in result_entries {
        let Some(path) = updated.get("path").and_then(Value::as_str) else {
            continue;
        };
        if let Some(entry) = merged.iter_mut().find(|entry| entry.path == path) {
            entry.extra = updated.get("extra").cloned();
        }
    }
    Ok(merged)
}

fn ensure_plugin_dirs(root: &Path) -> Result<()> {
    std::fs::create_dir_all(root.join("data")).context("create plugin data directory")?;
    std::fs::create_dir_all(root.join("logs")).context("create plugin logs directory")?;
    Ok(())
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

fn copy_dir_recursive(source: &Path, dest: &Path) -> Result<()> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let target = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), target)?;
        }
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

    #[test]
    fn merge_lister_applies_extra() {
        let entries = vec![FileEntry {
            name: "a.txt".into(),
            path: "a.txt".into(),
            is_dir: false,
            size: 1,
            modified: None,
            extra: None,
        }];
        let response = serde_json::json!({
            "result": {
                "entries": [{
                    "path": "a.txt",
                    "extra": {"plugin": "echo"}
                }]
            }
        });
        let merged = merge_lister_response(&entries, &response).unwrap();
        assert_eq!(
            merged[0].extra,
            Some(serde_json::json!({"plugin": "echo"}))
        );
    }
}
