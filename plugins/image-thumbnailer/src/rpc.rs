use std::io::{self, Read, Write};

use anyhow::{Context, Result, bail};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde_json::{Value, json};

use crate::cache::{self, file_mtime, resolve_source};
use crate::exif::parse_exif_fields;
use crate::thumb::{encode_thumbnail_from_bytes, hash_bytes};
use crate::SharedState;

pub fn run_loop(state: SharedState) -> Result<()> {
    loop {
        let message = read_message()?;
        let Some(message) = message else {
            break;
        };
        if let Some(response) = handle_message(&state, &message)? {
            write_message(&response)?;
        }
    }
    Ok(())
}

fn handle_message(state: &SharedState, message: &Value) -> Result<Option<Value>> {
    let request_id = message.get("id").cloned();
    let method = message
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();

    let result = match method {
        "initialize" => handle_initialize(state, message),
        "thumbnailer/generate" => handle_thumbnail(state, message),
        "viewer/preview" => handle_viewer_preview(message),
        "lister/enrich" => handle_lister_enrich(state, message),
        "watcher/notify" => handle_watcher_notify(state, message),
        "action/run" => handle_action_run(state, message),
        "" => bail!("missing method"),
        other => bail!("unknown method {other}"),
    };

    match result {
        Ok(value) => Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": value,
        }))),
        Err(error) => Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32000,
                "message": error.to_string(),
            }
        }))),
    }
}

fn handle_initialize(state: &SharedState, message: &Value) -> Result<Value> {
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let root_path = params
        .get("rootPath")
        .and_then(Value::as_str)
        .unwrap_or(".")
        .into();
    let storage_path = params
        .get("storagePath")
        .and_then(Value::as_str)
        .unwrap_or(".")
        .into();
    let cache = cache::Cache::open(std::path::Path::new(&storage_path))
        .context("open thumbnail cache")?;

    let mut guard = state.lock().expect("plugin state lock");
    guard.root_path = root_path;
    guard.storage_path = storage_path;
    guard.cache = cache;
    Ok(json!({ "ok": true }))
}

fn handle_thumbnail(state: &SharedState, message: &Value) -> Result<Value> {
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let path = params
        .get("path")
        .and_then(Value::as_str)
        .context("missing path")?;
    let tier = params
        .get("tier")
        .and_then(Value::as_str)
        .unwrap_or("grid");

    let guard = state.lock().expect("plugin state lock");
    let source = resolve_source(&guard.root_path, path)?;
    let mtime = file_mtime(&source)?;
    if let Some(content_hash) = guard.cache.lookup_hash(path, mtime)? {
        if let Some(bytes) = guard.cache.read_cached_bytes(&content_hash, tier)? {
            return Ok(thumbnail_result(bytes));
        }
    }

    let bytes = std::fs::read(&source).with_context(|| format!("read {}", source.display()))?;
    let content_hash = hash_bytes(&bytes);
    let webp = encode_thumbnail_from_bytes(&bytes, tier, guard.max_megapixels)?;
    guard
        .cache
        .write_cached_bytes(&content_hash, tier, &webp)?;
    guard.cache.store_hash(path, mtime, &content_hash)?;
    Ok(thumbnail_result(webp))
}

fn thumbnail_result(bytes: Vec<u8>) -> Value {
    json!({
        "contentType": "image/webp",
        "data": STANDARD.encode(bytes),
    })
}

fn handle_viewer_preview(message: &Value) -> Result<Value> {
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let path = params
        .get("path")
        .and_then(Value::as_str)
        .unwrap_or("");
    Ok(json!({
        "contentType": "application/vnd.zfiles.image-viewer+json",
        "body": serde_json::to_string(&json!({ "path": path, "kind": "image" }))?,
    }))
}

fn handle_lister_enrich(state: &SharedState, message: &Value) -> Result<Value> {
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let entries = params
        .get("entries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let guard = state.lock().expect("plugin state lock");
    let mut updated = Vec::new();
    for entry in entries {
        let Some(path) = entry.get("path").and_then(Value::as_str) else {
            continue;
        };
        if entry.get("is_dir").and_then(Value::as_bool) == Some(true) {
            continue;
        }
        if !is_image_path(path) {
            continue;
        }
        let source = match resolve_source(&guard.root_path, path) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let Ok(bytes) = std::fs::read(&source) else {
            continue;
        };
        updated.push(json!({
            "path": path,
            "extra": parse_exif_fields(&bytes),
        }));
    }
    Ok(json!({ "entries": updated }))
}

fn handle_watcher_notify(state: &SharedState, message: &Value) -> Result<Value> {
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let path = params
        .get("path")
        .and_then(Value::as_str)
        .context("missing path")?;
    let guard = state.lock().expect("plugin state lock");
    guard.cache.invalidate_path(path)?;
    Ok(json!({ "ok": true }))
}

fn handle_action_run(state: &SharedState, message: &Value) -> Result<Value> {
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let path = params
        .get("path")
        .and_then(Value::as_str)
        .context("missing path")?;
    let action_id = params
        .get("actionId")
        .and_then(Value::as_str)
        .context("missing actionId")?;
    if action_id != "plugin.image-thumbnailer.regenerate-thumbnails" {
        bail!("unknown action {action_id}");
    }
    let guard = state.lock().expect("plugin state lock");
    guard.cache.invalidate_path(path)?;
    Ok(json!({ "ok": true }))
}

fn is_image_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    [
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".tiff", ".tif", ".bmp", ".ico",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

fn read_message() -> Result<Option<Value>> {
    let mut header = Vec::new();
    loop {
        let mut byte = [0_u8; 1];
        if io::stdin().read_exact(&mut byte).is_err() {
            return Ok(None);
        }
        header.push(byte[0]);
        if header.len() >= 4 && header.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    let header_text = String::from_utf8(header).context("invalid header encoding")?;
    let length = header_text
        .lines()
        .find_map(|line| line.strip_prefix("Content-Length: "))
        .context("missing Content-Length header")?
        .trim()
        .parse::<usize>()
        .context("invalid Content-Length")?;
    let mut payload = vec![0_u8; length];
    io::stdin()
        .read_exact(&mut payload)
        .context("read message payload")?;
    Ok(Some(serde_json::from_slice(&payload)?))
}

fn write_message(message: &Value) -> Result<()> {
    let payload = serde_json::to_vec(message)?;
    write!(
        io::stdout(),
        "Content-Length: {}\r\n\r\n",
        payload.len()
    )?;
    io::stdout().write_all(&payload)?;
    io::stdout().flush()?;
    Ok(())
}
