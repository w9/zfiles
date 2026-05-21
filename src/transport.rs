use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::Router;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::middleware;
use axum::response::{IntoResponse, Json};
use axum::routing::get;
use serde::Deserialize;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::auth::{self, AuthConfig};
use crate::cli::Cli;
use crate::fs::{Fs, LocalFs};

#[derive(Clone)]
pub struct AppState {
    pub fs: Arc<dyn Fs>,
    pub auth: AuthConfig,
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    path: Option<String>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/list", get(list_directory))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::middleware,
        ))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub async fn serve(cli: Cli) -> Result<()> {
    let root = cli.root_path()?;
    let listener = TcpListener::bind(cli.listen_addr()?)
        .await
        .context("failed to bind TCP listener")?;
    let bound = listener.local_addr()?;

    let auth = if cli.token {
        let token = auth::generate_token();
        println!("Auth token: {token}");
        AuthConfig::with_token(token)
    } else {
        AuthConfig::disabled()
    };

    let state = AppState {
        fs: Arc::new(LocalFs::new(root.clone())),
        auth,
    };

    info!(root = %root.display(), addr = %bound, "zfiles listening");

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

async fn list_directory(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<crate::fs::FileEntry>>, AppError> {
    let relative = query.path.as_deref().unwrap_or("");
    let path = Path::new(relative);
    let entries = state.fs.read_dir(path).await?;
    Ok(Json(entries))
}

#[derive(Debug)]
struct AppError(anyhow::Error);

impl From<anyhow::Error> for AppError {
    fn from(error: anyhow::Error) -> Self {
        Self(error)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let message = self.0.to_string();
        let status = if message.contains("escapes") || message.contains("not allowed") {
            StatusCode::BAD_REQUEST
        } else if message.contains("failed to resolve path")
            || message.contains("failed to read directory")
        {
            StatusCode::NOT_FOUND
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        };

        (status, message).into_response()
    }
}
