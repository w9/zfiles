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
use crate::plugins::PluginSupervisor;
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
    pub plugins: Arc<PluginSupervisor>,
}

#[derive(Debug, Deserialize)]
struct PathQuery {
    path: Option<String>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/plugins", get(list_plugins))
        .route("/api/list", get(list_directory))
        .route("/api/search", get(search_directory))
        .route("/api/thumbnail", get(thumbnail_file))
        .route("/api/preview", get(preview_file))
        .route("/api/actions", get(list_actions).post(run_action))
        .route("/plugin/{name}/{*path}", get(plugin_static))
        .route("/api/stat", get(stat_path))
        .route("/api/file", get(download_file))
        .route("/api/upload", post(create_upload))
        .route("/api/upload/{id}", head(head_upload).patch(patch_upload))
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
    let dotfolder = dotfolder::resolve(&root, &config);
    let listener = TcpListener::bind(serve.listen_addr()?)
        .await
        .context("failed to bind TCP listener")?;
    let bound = listener.local_addr()?;

    let state_store = Arc::new(StateStore::with_dotfolder(root.clone(), dotfolder.clone()));
    let expires_at = if let Some(expire) = &serve.expire {
        let duration = duration::parse_duration(expire)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |duration| duration.as_secs() as i64);
        Some(now + duration.as_secs() as i64)
    } else {
        None
    };

    let auth = if serve.token {
        let token = auth::generate_token();
        if let Some(expires_at) = expires_at {
            state_store.create_session(&token, expires_at)?;
        }
        println!("Auth token: {token}");
        AuthConfig::with_token(token, expires_at)
    } else {
        AuthConfig::disabled()
    };

    let events = EventBus::new();
    let plugins = Arc::new(PluginSupervisor::with_dotfolder(root.clone(), dotfolder.clone()));
    let state = AppState {
        fs: Arc::new(LocalFs::new(root.clone())),
        auth,
        read_only: serve.read_only(&config),
        state: state_store,
        events: events.clone(),
        plugins: plugins.clone(),
    };

    if serve.should_open_browser(&config) {
        browser::open_async(format!("http://{bound}"));
    }

    if serve.token && serve.is_public_bind()? {
        let url = format!("http://{bound}");
        if let Err(error) = qr::print_url(&url) {
            tracing::warn!(%error, "failed to render QR code");
        }
    }

    mount::warn_if_cross_mount("dot-folder", &root, &dotfolder);

    watch::start(root.clone(), events.clone())?;
    plugins.clone().start_watcher_dispatch(events.clone());
    plugins.start_background(events);

    info!(root = %root.display(), addr = %bound, "zfiles listening");
    println!("zfiles listening on http://{bound}");

    axum::serve(listener, router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("HTTP server exited with error")
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn list_plugins(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.plugins.ready_plugins())
}

async fn list_directory(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
) -> Result<Json<Vec<crate::fs::FileEntry>>, AppError> {
    let relative = query.path.as_deref().unwrap_or("");
    let entries = state
        .fs
        .read_dir(std::path::Path::new(relative))
        .await?;
    let entries = state
        .plugins
        .enrich_listing(relative, entries, state.events.clone())
        .await;
    state
        .plugins
        .prefetch_thumbnails(&entries, state.events.clone());
    Ok(Json(entries))
}

async fn list_actions(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
) -> Result<Json<Vec<crate::plugins::ActionItem>>, AppError> {
    let relative = query
        .path
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;
    let actions = state.plugins.actions(relative).await;
    Ok(Json(actions))
}

#[derive(Debug, Deserialize)]
struct RunActionBody {
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    paths: Vec<String>,
    action_id: String,
}

async fn run_action(
    State(state): State<AppState>,
    Json(body): Json<RunActionBody>,
) -> Result<StatusCode, AppError> {
    let mut targets = body.paths;
    if let Some(path) = body.path {
        targets.push(path);
    }
    if targets.is_empty() {
        return Err(AppError(anyhow::anyhow!("path or paths is required")));
    }
    state
        .plugins
        .run_actions(&targets, &body.action_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn plugin_static(
    State(state): State<AppState>,
    AxumPath((name, path)): AxumPath<(String, String)>,
) -> Result<Response, AppError> {
    if let Ok(absolute) = state.plugins.resolve_plugin_asset(&name, &path) {
        return serve_plugin_file(absolute).await;
    }

    if state.plugins.has_route(&name) {
        let route_path = format!("/{path}");
        let Some((status, content_type, bytes)) = state
            .plugins
            .route_handle(&name, "GET", &route_path)
            .await
        else {
            return Err(AppError(anyhow::anyhow!("route unavailable")));
        };
        let status_code =
            StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let mut response = Response::new(Body::from(bytes));
        *response.status_mut() = status_code;
        response.headers_mut().insert(
            CONTENT_TYPE,
            HeaderValue::from_str(&content_type)
                .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
        );
        return Ok(response);
    }

    Err(AppError(anyhow::anyhow!("plugin asset not found")))
}

async fn serve_plugin_file(absolute: std::path::PathBuf) -> Result<Response, AppError> {
    let content_type = from_path(&absolute)
        .first()
        .map(|mime| mime.to_string())
        .unwrap_or_else(|| "application/octet-stream".into());
    let bytes = tokio::fs::read(&absolute).await?;
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str(&content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    Ok(response)
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    path: Option<String>,
    q: String,
}

async fn search_directory(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<crate::fs::FileEntry>>, AppError> {
    let relative = query.path.as_deref().unwrap_or("");
    let results = state
        .plugins
        .search(relative, &query.q)
        .await
        .unwrap_or_default();
    Ok(Json(results))
}

async fn thumbnail_file(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
) -> Result<Response, AppError> {
    let relative = query
        .path
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;

    let Some((content_type, bytes)) = state.plugins.thumbnail(relative).await else {
        return Err(AppError(anyhow::anyhow!("thumbnail unavailable")));
    };

    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str(&content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    Ok(response)
}

async fn preview_file(
    State(state): State<AppState>,
    Query(query): Query<PathQuery>,
) -> Result<Response, AppError> {
    let relative = query
        .path
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;

    let Some((content_type, body)) = state.plugins.preview(relative).await else {
        return Err(AppError(anyhow::anyhow!("preview unavailable")));
    };

    let mut response = Response::new(Body::from(body));
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str(&content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("text/plain")),
    );
    Ok(response)
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

    let relative_path = parse_upload_metadata(headers.get(&HDR_UPLOAD_METADATA))?
        .ok_or_else(|| AppError(anyhow::anyhow!("Upload-Metadata filename is required")))?;

    let record = state
        .state
        .create_upload(relative_path, Some(upload_length))?;

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

async fn ws_upgrade(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state.events))
}

async fn handle_ws(mut socket: WebSocket, events: EventBus) {
    let connected = KernelEvent::Connected {
        version: env!("CARGO_PKG_VERSION").into(),
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

async fn static_or_index(request: axum::http::Request<Body>) -> impl IntoResponse {
    let accept_encoding = request
        .headers()
        .get(axum::http::header::ACCEPT_ENCODING)
        .and_then(|value| value.to_str().ok());
    embed::serve_static(request.uri().path(), accept_encoding)
}

fn parse_upload_metadata(value: Option<&HeaderValue>) -> Result<Option<String>, AppError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata")))?;

    for part in value.split(',') {
        let part = part.trim();
        if let Some(encoded) = part.strip_prefix("filename ") {
            use base64::Engine;
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(encoded.trim())
                .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata filename")))?;
            let filename = String::from_utf8(decoded)
                .map_err(|_| AppError(anyhow::anyhow!("invalid Upload-Metadata filename")))?;
            return Ok(Some(filename));
        }
    }

    Ok(None)
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
        } else if message.contains("escapes") || message.contains("not allowed") {
            StatusCode::BAD_REQUEST
        } else if message.contains("not found")
            || message.contains("failed to resolve path")
            || message.contains("failed to read directory")
            || message.contains("failed to stat path")
            || message.contains("thumbnail unavailable")
            || message.contains("preview unavailable")
            || message.contains("action unavailable")
            || message.contains("plugin asset")
        {
            StatusCode::NOT_FOUND
        } else if message.contains("cannot download a directory") {
            StatusCode::BAD_REQUEST
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
    fn parse_upload_metadata_filename() {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode("notes.txt");
        let value = HeaderValue::from_str(&format!("filename {encoded}")).unwrap();
        let path = parse_upload_metadata(Some(&value)).unwrap();
        assert_eq!(path.as_deref(), Some("notes.txt"));
    }
}
