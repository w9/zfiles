use std::sync::Arc;

use anyhow::Context;
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket};
use axum::http::header::{
    ACCEPT, ACCEPT_ENCODING, ACCEPT_LANGUAGE, CACHE_CONTROL, CONNECTION, COOKIE, HOST,
    IF_NONE_MATCH, ORIGIN, PRAGMA, REFERER, SEC_WEBSOCKET_EXTENSIONS, SEC_WEBSOCKET_KEY,
    SEC_WEBSOCKET_PROTOCOL, SEC_WEBSOCKET_VERSION, USER_AGENT,
};
use axum::http::{HeaderMap, HeaderName, Request, Response, Uri};
use axum::response::{Html, IntoResponse};
use futures_util::{SinkExt, StreamExt};
use reqwest::redirect::Policy;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

const HOP_BY_HOP: [&str; 8] = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-connection",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
];

const FORWARD_REQUEST_HEADERS: &[HeaderName] = &[
    ACCEPT,
    ACCEPT_ENCODING,
    ACCEPT_LANGUAGE,
    CACHE_CONTROL,
    COOKIE,
    IF_NONE_MATCH,
    ORIGIN,
    PRAGMA,
    REFERER,
    SEC_WEBSOCKET_EXTENSIONS,
    SEC_WEBSOCKET_KEY,
    SEC_WEBSOCKET_PROTOCOL,
    SEC_WEBSOCKET_VERSION,
    USER_AGENT,
];

#[derive(Clone)]
pub struct ViteDevProxy {
    base: reqwest::Url,
    client: reqwest::Client,
}

impl ViteDevProxy {
    pub fn new(vite_url: &str) -> anyhow::Result<Self> {
        let mut base = reqwest::Url::parse(vite_url)
            .with_context(|| format!("invalid Vite dev URL {vite_url:?}"))?;
        if !base.scheme().starts_with("http") {
            anyhow::bail!("Vite dev URL must use http or https, got {}", base.scheme());
        }
        if base.path() != "/" {
            base.set_path("/");
        }
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .build()
            .context("failed to build Vite proxy HTTP client")?;
        Ok(Self { base, client })
    }

    pub fn base_url(&self) -> &reqwest::Url {
        &self.base
    }

    pub fn target_uri(&self, request_uri: &Uri) -> anyhow::Result<reqwest::Url> {
        let path_and_query = request_uri
            .path_and_query()
            .map(|value| value.as_str())
            .unwrap_or("/");
        self.base
            .join(path_and_query.trim_start_matches('/'))
            .or_else(|_| self.base.join(path_and_query))
            .with_context(|| format!("failed to resolve Vite target for {path_and_query}"))
    }

    pub fn websocket_url(&self, request_uri: &Uri) -> anyhow::Result<String> {
        let mut target = self.target_uri(request_uri)?;
        match target.scheme() {
            "https" => target.set_scheme("wss").ok(),
            _ => target.set_scheme("ws").ok(),
        };
        Ok(target.to_string())
    }

    pub async fn forward_http(&self, request: Request<Body>) -> Response<Body> {
        match self.forward_http_inner(request).await {
            Ok(response) => response,
            Err(error) => proxy_error_response(error),
        }
    }

    async fn forward_http_inner(&self, request: Request<Body>) -> anyhow::Result<Response<Body>> {
        let (parts, body) = request.into_parts();
        let target = self.target_uri(&parts.uri)?;
        let method = parts.method;
        let body_bytes = axum::body::to_bytes(body, usize::MAX).await?;

        let mut builder = self.client.request(method.clone(), target);
        for header_name in FORWARD_REQUEST_HEADERS {
            if let Some(value) = parts.headers.get(header_name) {
                builder = builder.header(header_name, value);
            }
        }

        let upstream = builder.body(body_bytes).send().await?;
        let status = upstream.status();
        let headers = upstream.headers().clone();
        let bytes = upstream.bytes().await?;

        let mut response = Response::builder().status(status);
        for (name, value) in headers.iter() {
            if is_hop_by_hop(name) {
                continue;
            }
            response = response.header(name, value);
        }

        Ok(response.body(Body::from(bytes))?)
    }

    pub async fn forward_websocket(
        self: Arc<Self>,
        client: WebSocket,
        request_uri: Uri,
        request_headers: HeaderMap,
    ) {
        let ws_url = match self.websocket_url(&request_uri) {
            Ok(url) => url,
            Err(error) => {
                tracing::warn!(%error, "failed to resolve Vite websocket URL");
                return;
            }
        };

        let ws_url_for_log = ws_url.clone();
        let mut request = match ws_url.into_client_request() {
            Ok(request) => request,
            Err(error) => {
                tracing::warn!(%error, "failed to build Vite websocket request");
                return;
            }
        };

        for header_name in FORWARD_REQUEST_HEADERS {
            if header_name == &HOST {
                continue;
            }
            if let Some(value) = request_headers.get(header_name) {
                request.headers_mut().insert(header_name, value.clone());
            }
        }

        let upstream = match connect_async(request).await {
            Ok((stream, _)) => stream,
            Err(error) => {
                tracing::warn!(%error, url = %ws_url_for_log, "failed to connect to Vite websocket");
                return;
            }
        };

        let (mut client_sink, mut client_stream) = client.split();
        let (mut upstream_sink, mut upstream_stream) = upstream.split();

        let client_to_upstream = async {
            while let Some(message) = client_stream.next().await {
                match message {
                    Ok(Message::Text(text)) => {
                        if upstream_sink
                            .send(tokio_tungstenite::tungstenite::Message::Text(
                                text.to_string().into(),
                            ))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(Message::Binary(data)) => {
                        if upstream_sink
                            .send(tokio_tungstenite::tungstenite::Message::Binary(data))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(Message::Ping(payload)) => {
                        if upstream_sink
                            .send(tokio_tungstenite::tungstenite::Message::Ping(payload))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(Message::Pong(payload)) => {
                        if upstream_sink
                            .send(tokio_tungstenite::tungstenite::Message::Pong(payload))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(Message::Close(_)) | Err(_) => break,
                }
            }
        };

        let upstream_to_client = async {
            while let Some(message) = upstream_stream.next().await {
                match message {
                    Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                        if client_sink
                            .send(Message::Text(text.to_string().into()))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(tokio_tungstenite::tungstenite::Message::Binary(data)) => {
                        if client_sink
                            .send(Message::Binary(data.into()))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(tokio_tungstenite::tungstenite::Message::Ping(payload)) => {
                        if client_sink
                            .send(Message::Ping(payload.into()))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(tokio_tungstenite::tungstenite::Message::Pong(payload)) => {
                        if client_sink
                            .send(Message::Pong(payload.into()))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Ok(tokio_tungstenite::tungstenite::Message::Frame(_)) => {}
                    Ok(tokio_tungstenite::tungstenite::Message::Close(_)) | Err(_) => break,
                }
            }
        };

        tokio::select! {
            () = client_to_upstream => {}
            () = upstream_to_client => {}
        }
    }
}

fn is_hop_by_hop(name: &HeaderName) -> bool {
    HOP_BY_HOP
        .iter()
        .any(|hop| name.as_str().eq_ignore_ascii_case(hop))
        || name.as_str().eq_ignore_ascii_case("content-length")
        || name.as_str().eq_ignore_ascii_case("upgrade")
}

fn proxy_error_response(error: anyhow::Error) -> Response<Body> {
    tracing::warn!(%error, "Vite dev proxy request failed");
    Html(format!(
        r#"<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>zfiles dev frontend</title></head>
  <body>
    <h1>Vite dev server unavailable</h1>
    <p>Start the frontend with <code>cd web &amp;&amp; pnpm dev</code>, then reload.</p>
    <p><code>{error}</code></p>
  </body>
</html>"#
    ))
    .into_response()
}

pub fn is_websocket_upgrade(headers: &HeaderMap) -> bool {
    headers
        .get(CONNECTION)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.to_ascii_lowercase().contains("upgrade"))
        && headers
            .get(HeaderName::from_static("upgrade"))
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.eq_ignore_ascii_case("websocket"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn target_uri_preserves_path_and_query() {
        let proxy = ViteDevProxy::new("http://127.0.0.1:5173").unwrap();
        let uri: Uri = "/src/main.tsx?import".parse().unwrap();
        let target = proxy.target_uri(&uri).unwrap();
        assert_eq!(target.as_str(), "http://127.0.0.1:5173/src/main.tsx?import");
    }

    #[test]
    fn websocket_url_uses_ws_scheme() {
        let proxy = ViteDevProxy::new("http://127.0.0.1:5173").unwrap();
        let uri: Uri = "/?token=abc".parse().unwrap();
        let target = proxy.websocket_url(&uri).unwrap();
        assert_eq!(target, "ws://127.0.0.1:5173/?token=abc");
    }

    #[test]
    fn rejects_non_http_vite_url() {
        assert!(ViteDevProxy::new("ws://127.0.0.1:5173").is_err());
    }

    #[test]
    fn detects_websocket_upgrade_headers() {
        let mut headers = HeaderMap::new();
        assert!(!is_websocket_upgrade(&headers));

        headers.insert(CONNECTION, HeaderValue::from_static("Upgrade"));
        headers.insert(
            HeaderName::from_static("upgrade"),
            HeaderValue::from_static("websocket"),
        );
        assert!(is_websocket_upgrade(&headers));
    }
}
