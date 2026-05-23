use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::sync::Once;

use anyhow::{Context, Result, bail};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::DynamicImage;
use image_thumbnailer::{
    cache::{self, resolve_source},
    new_state,
    thumb::{encode_thumbnail_from_dynamic_image, hash_bytes},
    SharedState,
};
use libheif_rs::integration::image::register_all_decoding_hooks;
use serde_json::{Value, json};

static REGISTER_HEIC: Once = Once::new();

pub fn run_loop() -> Result<()> {
    let state = new_state();
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
        "watcher/notify" => handle_watcher_notify(state, message),
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
    let cache = cache::Cache::open(std::path::Path::new(&storage_path))?;
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
    let mtime = cache::file_mtime(&source)?;
    if let Some(content_hash) = guard.cache.lookup_hash(path, mtime)? {
        if let Some(bytes) = guard.cache.read_cached_bytes(&content_hash, tier)? {
            return Ok(thumbnail_result(bytes));
        }
    }

    let bytes = std::fs::read(&source).with_context(|| format!("read {}", source.display()))?;
    let content_hash = hash_bytes(&bytes);
    let image = decode_heic(&source)?;
    let webp = encode_thumbnail_from_dynamic_image(image, tier)?;
    guard
        .cache
        .write_cached_bytes(&content_hash, tier, &webp)?;
    guard.cache.store_hash(path, mtime, &content_hash)?;
    Ok(thumbnail_result(webp))
}

fn decode_heic(path: &PathBuf) -> Result<DynamicImage> {
    REGISTER_HEIC.call_once(register_all_decoding_hooks);
    image::open(path).with_context(|| format!("decode heic {}", path.display()))
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

fn thumbnail_result(bytes: Vec<u8>) -> Value {
    json!({
        "contentType": "image/webp",
        "data": STANDARD.encode(bytes),
    })
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
