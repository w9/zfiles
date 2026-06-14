use std::sync::Arc;

use anyhow::Context;
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, LOCATION};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, head, post};
use axum::{Router, body::Bytes};
use futures_util::StreamExt;
use mime_guess::from_path;
use serde::Deserialize;
use tokio::net::TcpListener;
use tracing::info;

use crate::auth::{self, AuthConfig};
use crate::banner;
use crate::browser;
use crate::cli::ServeArgs;
use crate::config::Config;
use crate::dotfolder;
use crate::download;
use crate::duration;
use crate::embed;
use crate::events::{EventBus, KernelEvent};
use crate::fs::{FileStat, Fs, LocalFs};
use crate::mount;
use crate::qr;
use crate::range;
use crate::state::StateStore;
use crate::watch;

const HDR_UPLOAD_LENGTH: HeaderName = HeaderName::from_static("upload-length");
const HDR_UPLOAD_METADATA: HeaderName = HeaderName::from_static("upload-metadata");
const HDR_UPLOAD_OFFSET: HeaderName = HeaderName::from_static("upload-offset");

#[derive(Clone)]
pub struct AppState {
    pub fs: Arc<LocalFs>,
    pub auth: AuthConfig,
    pub read_only: bool,
    pub state: Arc<StateStore>,
    pub events: EventBus,
    #[cfg(feature = "dev-frontend")]
    pub vite_dev: Option<Arc<crate::vite_proxy::ViteDevProxy>>,
}

impl AppState {
    pub fn new(
        fs: Arc<LocalFs>,
        auth: AuthConfig,
        read_only: bool,
        state: Arc<StateStore>,
        events: EventBus,
    ) -> Self {
        Self {
            fs,
            auth,
            read_only,
            state,
            events,
            #[cfg(feature = "dev-frontend")]
            vite_dev: None,
        }
    }
}

#[derive(Debug, Deserialize)]
struct PathQuery {
    path: Option<String>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/list", get(list_directory))
        .route("/api/actions", post(run_action))
        .route("/api/keybindings", get(list_keybindings))
        .route("/api/metadata", get(stat_path))
        .route("/api/file", get(download_file))
        .route("/api/upload", post(create_upload))
        .route(
            "/api/upload/{id}",
            head(head_upload).patch(patch_upload).delete(delete_upload),
        )
        .route("/api/ws", get(ws_upgrade))
        .fallback(static_or_index)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::read_only_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::middleware,
        ))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state)
}

pub async fn serve(serve: ServeArgs) -> anyhow::Result<()> {
    serve.validate()?;
    let root = serve.root_path()?;
    let config = Config::load(&root)?;
    let layout = dotfolder::plan_serve_layout(&root, &config, serve.read_only);
    let state_dir = layout.state_dir.clone();
    let read_only = layout.read_only;
    let listener = TcpListener::bind(serve.listen_addr()?)
        .await
        .context("failed to bind TCP listener")?;
    let bound = listener.local_addr()?;

    let state_store = Arc::new(StateStore::with_state_dir(root.clone(), state_dir.clone()));
    let expires_at = if let Some(expire) = &serve.expire {
        let duration = duration::parse_duration(expire)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |duration| duration.as_secs() as i64);
        Some(now + duration.as_secs() as i64)
    } else {
        None
    };

    let share_token = if serve.token {
        let token = auth::generate_token();
        Some(token)
    } else {
        None
    };

    let auth = if let Some(token) = share_token.as_deref() {
        AuthConfig::with_token(token.to_string(), expires_at)
    } else {
        AuthConfig::disabled()
    };

    let events = EventBus::new();
    #[cfg(feature = "dev-frontend")]
    let vite_dev = if serve.vite_dev_enabled() {
        Some(Arc::new(crate::vite_proxy::ViteDevProxy::new(
            serve.vite_dev_url(),
        )?))
    } else {
        None
    };
    let state = AppState {
        fs: Arc::new(LocalFs::with_symlink_policy(
            root.clone(),
            serve.resolve_follow_symlinks_outside_root()?,
        )),
        auth,
        read_only,
        state: state_store,
        events: events.clone(),
        #[cfg(feature = "dev-frontend")]
        vite_dev,
    };

    let open_browser = serve.should_open_browser(&config);
    let ui_lang = serve.locale()?;
    let explorer_url = browser::open_url(&bound, share_token.as_deref(), ui_lang);
    let public_share = serve.token && serve.is_public_bind()?;

    banner::ServeBanner {
        root: root.display().to_string(),
        url: explorer_url.clone(),
        token: share_token.clone(),
        open_browser,
        read_only,
        auto_read_only: layout.auto_read_only,
        state_dir: Some(state_dir.display().to_string()),
        public_share,
        #[cfg(feature = "dev-frontend")]
        vite_dev: serve
            .vite_dev_enabled()
            .then(|| serve.vite_dev_url().to_string()),
        #[cfg(not(feature = "dev-frontend"))]
        vite_dev: None,
    }
    .print();

    if open_browser {
        browser::open_async(explorer_url.clone());
    }

    if public_share && let Err(error) = qr::print_url(&explorer_url) {
        tracing::warn!(%error, "failed to render QR code");
    }

    mount::warn_if_cross_mount("upload spool", &root, &state_dir);

    watch::start(root.clone(), events.clone())?;

    info!(root = %root.display(), addr = %bound, "zfiles listening");

    axum::serve(listener, router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("HTTP server exited with error")
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "read_only": state.read_only,
        "follow_symlinks_outside_root": state.fs.follow_symlinks_outside_root(),
    }))
}

async fn list_directory(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
) -> Result<Json<Vec<crate::fs::FileEntry>>, AppError> {
    let relative = query.path.as_deref().unwrap_or("");
    let entries = state.fs.read_dir(std::path::Path::new(relative)).await?;
    Ok(Json(entries))
}

async fn list_keybindings() -> Json<crate::keybindings::KeybindingsFile> {
    Json(crate::keybindings::load_user_keybindings())
}

#[derive(Debug, Deserialize)]
struct RunActionBody {
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    paths: Vec<String>,
    action_id: String,
    #[serde(default)]
    dest_dir: Option<String>,
    #[serde(default)]
    new_name: Option<String>,
    #[serde(default)]
    overwrite: bool,
}

const KERNEL_ACTION_DELETE: &str = "file.delete";
const KERNEL_ACTION_MKDIR: &str = "file.mkdir";
const KERNEL_ACTION_RENAME: &str = "file.rename";
const KERNEL_ACTION_COPY: &str = "file.copy";
const KERNEL_ACTION_MOVE: &str = "file.move";

async fn run_action(
    State(state): State<AppState>,
    Json(body): Json<RunActionBody>,
) -> Result<StatusCode, AppError> {
    let mut targets = body.paths;
    if let Some(path) = &body.path {
        targets.push(path.clone());
    }

    match body.action_id.as_str() {
        KERNEL_ACTION_DELETE => {
            if targets.is_empty() {
                return Err(AppError(anyhow::anyhow!("path or paths is required")));
            }
            let mut parents = std::collections::HashSet::new();
            for path in targets {
                state.fs.delete_path(std::path::Path::new(&path)).await?;
                parents.insert(parent_listing_path(&path));
            }
            for parent in parents {
                state
                    .events
                    .publish(KernelEvent::FilesystemChanged { path: parent });
            }
            Ok(StatusCode::NO_CONTENT)
        }
        KERNEL_ACTION_MKDIR => {
            let parent = targets
                .first()
                .map(String::as_str)
                .or(body.path.as_deref())
                .unwrap_or_default();
            let name = body
                .new_name
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("new_name is required"))?;
            let created = state
                .fs
                .create_dir(std::path::Path::new(parent), name)
                .await?;
            state.events.publish(KernelEvent::FilesystemChanged {
                path: parent_listing_path(&created),
            });
            Ok(StatusCode::NO_CONTENT)
        }
        KERNEL_ACTION_RENAME => {
            let path = targets
                .first()
                .or(body.path.as_ref())
                .ok_or_else(|| anyhow::anyhow!("path is required"))?
                .as_str();
            let new_name = body
                .new_name
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("new_name is required"))?;
            let renamed = state
                .fs
                .rename_path(std::path::Path::new(path), new_name, body.overwrite)
                .await?;
            state.events.publish(KernelEvent::FilesystemChanged {
                path: parent_listing_path(&renamed),
            });
            if parent_listing_path(path) != parent_listing_path(&renamed) {
                state.events.publish(KernelEvent::FilesystemChanged {
                    path: parent_listing_path(path),
                });
            }
            Ok(StatusCode::NO_CONTENT)
        }
        KERNEL_ACTION_COPY => {
            if targets.is_empty() {
                return Err(AppError(anyhow::anyhow!("paths is required")));
            }
            let dest_dir = body
                .dest_dir
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("dest_dir is required"))?;
            let mut parents = std::collections::HashSet::new();
            parents.insert(dest_dir.to_string());
            let dest_name = body.new_name.as_deref().filter(|_| targets.len() == 1);
            for source in targets {
                let created = state
                    .fs
                    .copy_into_dir(
                        std::path::Path::new(&source),
                        std::path::Path::new(dest_dir),
                        dest_name,
                        body.overwrite,
                    )
                    .await?;
                parents.insert(parent_listing_path(&created));
                parents.insert(parent_listing_path(&source));
            }
            for parent in parents {
                state
                    .events
                    .publish(KernelEvent::FilesystemChanged { path: parent });
            }
            Ok(StatusCode::NO_CONTENT)
        }
        KERNEL_ACTION_MOVE => {
            if targets.is_empty() {
                return Err(AppError(anyhow::anyhow!("paths is required")));
            }
            let dest_dir = body
                .dest_dir
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("dest_dir is required"))?;
            let mut parents = std::collections::HashSet::new();
            parents.insert(dest_dir.to_string());
            let dest_name = body.new_name.as_deref().filter(|_| targets.len() == 1);
            for source in targets {
                let moved = state
                    .fs
                    .move_into_dir(
                        std::path::Path::new(&source),
                        std::path::Path::new(dest_dir),
                        dest_name,
                        body.overwrite,
                    )
                    .await?;
                parents.insert(parent_listing_path(&moved));
                parents.insert(parent_listing_path(&source));
            }
            for parent in parents {
                state
                    .events
                    .publish(KernelEvent::FilesystemChanged { path: parent });
            }
            Ok(StatusCode::NO_CONTENT)
        }
        _ => Err(AppError(anyhow::anyhow!(
            "unknown action: {}",
            body.action_id
        ))),
    }
}

fn parent_listing_path(relative: &str) -> String {
    relative
        .rsplit_once('/')
        .map(|(parent, _)| parent.to_string())
        .unwrap_or_default()
}

async fn stat_path(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
) -> Result<Json<FileStat>, AppError> {
    let relative = query
        .path
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;
    let stat = state.fs.stat(std::path::Path::new(relative)).await?;
    Ok(Json(stat))
}

async fn download_file(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let relative = query
        .path
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;

    let absolute = state.fs.resolve(std::path::Path::new(relative))?;
    let metadata = tokio::fs::metadata(&absolute).await?;
    if metadata.is_dir() {
        return Err(AppError(anyhow::anyhow!("cannot download a directory")));
    }

    let file_size = metadata.len();
    let content_type = from_path(&absolute)
        .first()
        .map(|mime| mime.to_string())
        .unwrap_or_else(|| "application/octet-stream".into());

    let (status, start, content_length) =
        if let Some(range_header) = headers.get("range").and_then(|value| value.to_str().ok()) {
            let range = range::parse_range_header(range_header, file_size)?;
            (StatusCode::PARTIAL_CONTENT, range.start, range.len())
        } else {
            (StatusCode::OK, 0, file_size)
        };

    let body = download::body_for_range(&absolute, start, content_length).await?;

    let mut response = Response::new(body);
    *response.status_mut() = status;
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str(&content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    response
        .headers_mut()
        .insert(ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    response.headers_mut().insert(
        CONTENT_LENGTH,
        HeaderValue::from_str(&content_length.to_string()).expect("content length fits in header"),
    );

    if status == StatusCode::PARTIAL_CONTENT {
        let end = start + content_length.saturating_sub(1);
        response.headers_mut().insert(
            CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {start}-{end}/{file_size}"))
                .expect("content range fits in header"),
        );
    }

    Ok(response)
}

async fn create_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let upload_length = headers
        .get(&HDR_UPLOAD_LENGTH)
        .and_then(|value| value.to_str().ok())
        .map(str::parse::<u64>)
        .transpose()
        .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Length")))?
        .ok_or_else(|| AppError(anyhow::anyhow!("Upload-Length is required")))?;

    let parsed = parse_upload_metadata(headers.get(&HDR_UPLOAD_METADATA))?;

    let record = state.state.create_upload(
        parsed.relative_path,
        Some(upload_length),
        parsed.checksum_sha256,
    )?;

    let location = format!("/api/upload/{}", record.id);
    let mut response = StatusCode::CREATED.into_response();
    response.headers_mut().insert(
        LOCATION,
        HeaderValue::from_str(&location).expect("location fits in header"),
    );
    response
        .headers_mut()
        .insert(HDR_UPLOAD_OFFSET, HeaderValue::from_static("0"));
    Ok(response)
}

async fn head_upload(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, AppError> {
    let record = state
        .state
        .get_upload(&id)?
        .ok_or_else(|| AppError(anyhow::anyhow!("upload not found")))?;

    let mut response = Response::new(Body::empty());
    response.headers_mut().insert(
        HDR_UPLOAD_OFFSET,
        HeaderValue::from_str(&record.offset.to_string()).expect("upload offset fits in header"),
    );
    if let Some(size) = record.size {
        response.headers_mut().insert(
            HDR_UPLOAD_LENGTH,
            HeaderValue::from_str(&size.to_string()).expect("upload length fits in header"),
        );
    }
    Ok(response)
}

async fn patch_upload(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, AppError> {
    let expected_offset = headers
        .get(&HDR_UPLOAD_OFFSET)
        .and_then(|value| value.to_str().ok())
        .map(str::parse::<u64>)
        .transpose()
        .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Offset")))?
        .ok_or_else(|| AppError(anyhow::anyhow!("Upload-Offset is required")))?;

    let record = state
        .state
        .get_upload(&id)?
        .ok_or_else(|| AppError(anyhow::anyhow!("upload not found")))?;

    if record.offset != expected_offset {
        return Err(AppError(anyhow::anyhow!("upload offset conflict")));
    }

    let updated = state.state.append_upload(&id, &body)?;
    state.events.publish(KernelEvent::UploadProgress {
        id: id.clone(),
        offset: updated.offset,
        length: updated.size,
    });

    if updated.size.is_some_and(|size| updated.offset == size) {
        state.state.finalize_upload(&id, &state.fs)?;
    }

    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        HDR_UPLOAD_OFFSET,
        HeaderValue::from_str(&updated.offset.to_string()).expect("upload offset fits in header"),
    );
    Ok(response)
}

async fn delete_upload(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, AppError> {
    state.state.abort_upload(&id)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn ws_upgrade(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state.events, state.read_only))
}

async fn handle_ws(mut socket: WebSocket, events: EventBus, read_only: bool) {
    let connected = KernelEvent::Connected {
        version: env!("CARGO_PKG_VERSION").into(),
        read_only,
    };
    if socket
        .send(Message::Text(
            serde_json::to_string(&connected)
                .expect("kernel event serializes")
                .into(),
        ))
        .await
        .is_err()
    {
        return;
    }

    let mut rx = events.subscribe();
    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Ok(event) => {
                        let text = serde_json::to_string(&event).expect("kernel event serializes");
                        if socket.send(Message::Text(text.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
            incoming = socket.next() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

async fn static_or_index(
    #[cfg_attr(not(feature = "dev-frontend"), allow(unused_variables))] State(state): State<
        AppState,
    >,
    request: axum::http::Request<Body>,
) -> Response {
    let path = request.uri().path();
    if path.starts_with("/api/") || path.starts_with("/plugin/") {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    }

    #[cfg(feature = "dev-frontend")]
    if let Some(proxy) = &state.vite_dev {
        use axum::extract::FromRequestParts;

        if path.starts_with("/file-icons/")
            && let Some(response) = embed::try_serve_static(path)
        {
            return response;
        }

        let (mut parts, body) = request.into_parts();
        if crate::vite_proxy::is_websocket_upgrade(&parts.headers) {
            match WebSocketUpgrade::from_request_parts(&mut parts, &state).await {
                Ok(ws) => {
                    let uri = parts.uri.clone();
                    let headers = parts.headers.clone();
                    let proxy = Arc::clone(proxy);
                    return ws
                        .on_upgrade(move |socket| async move {
                            proxy.forward_websocket(socket, uri, headers).await;
                        })
                        .into_response();
                }
                Err(rejection) => return rejection.into_response(),
            }
        }
        let request = axum::http::Request::from_parts(parts, body);
        return proxy.forward_http(request).await;
    }

    embed::serve_static(path)
}

struct ParsedUploadMetadata {
    relative_path: String,
    checksum_sha256: String,
}

fn parse_upload_metadata(value: Option<&HeaderValue>) -> Result<ParsedUploadMetadata, AppError> {
    let Some(value) = value else {
        return Err(AppError(anyhow::anyhow!(
            "Upload-Metadata filename and checksum are required"
        )));
    };
    let value = value
        .to_str()
        .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata")))?;

    let mut relative_path = None;
    let mut checksum_sha256 = None;

    for part in value.split(',') {
        let part = part.trim();
        if let Some(encoded) = part.strip_prefix("filename ") {
            use base64::Engine;
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(encoded.trim())
                .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata filename")))?;
            let filename = String::from_utf8(decoded)
                .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata filename")))?;
            relative_path = Some(filename);
        } else if let Some(encoded) = part.strip_prefix("checksum ") {
            use base64::Engine;
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(encoded.trim())
                .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata checksum")))?;
            if decoded.len() != 32 {
                return Err(AppError(anyhow::anyhow!(
                    "invalid Upload-Metadata checksum length"
                )));
            }
            checksum_sha256 = Some(base64::engine::general_purpose::STANDARD.encode(decoded));
        }
    }

    Ok(ParsedUploadMetadata {
        relative_path: relative_path
            .ok_or_else(|| AppError(anyhow::anyhow!("Upload-Metadata filename is required")))?,
        checksum_sha256: checksum_sha256
            .ok_or_else(|| AppError(anyhow::anyhow!("Upload-Metadata checksum is required")))?,
    })
}

#[derive(Debug)]
struct AppError(anyhow::Error);

impl From<anyhow::Error> for AppError {
    fn from(error: anyhow::Error) -> Self {
        Self(error)
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self(error.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let message = self.0.to_string();
        let status = if message.contains("offset conflict") {
            StatusCode::CONFLICT
        } else if message.contains("checksum mismatch")
            || message.contains("Upload-Metadata")
            || message.contains("invalid Upload-Metadata")
            || message.contains("escapes")
            || message.contains("not allowed")
            || message.contains("cannot download a directory")
        {
            StatusCode::BAD_REQUEST
        } else if message.contains("not found")
            || message.contains("failed to resolve path")
            || message.contains("failed to read directory")
            || message.contains("failed to stat path")
            || message.contains("unknown action")
        {
            StatusCode::NOT_FOUND
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        };

        (status, message).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_upload_metadata_filename_and_checksum() {
        use base64::Engine;
        let filename = base64::engine::general_purpose::STANDARD.encode("notes.txt");
        let checksum = base64::engine::general_purpose::STANDARD.encode([0u8; 32]);
        let value =
            HeaderValue::from_str(&format!("filename {filename},checksum {checksum}")).unwrap();
        let parsed = parse_upload_metadata(Some(&value)).unwrap();
        assert_eq!(parsed.relative_path, "notes.txt");
        assert_eq!(parsed.checksum_sha256, checksum);
    }
}
