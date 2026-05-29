use axum::body::Body;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::Response;
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "web/dist/"]
struct Assets;

const FALLBACK_INDEX: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>zfiles</title>
  </head>
  <body>
    <h1>zfiles</h1>
    <p>Frontend assets are not built yet. Run <code>cd web && pnpm install && pnpm build</code>.</p>
    <p>The REST API is available under <code>/api/</code>.</p>
  </body>
</html>
"#;

pub fn serve_static(path: &str) -> Response {
    if let Some(response) = try_serve_static(path) {
        return response;
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(FALLBACK_INDEX))
        .expect("fallback index response")
}

pub fn try_serve_static(path: &str) -> Option<Response> {
    let path = path.trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some(content) = Assets::get(path) {
        return Some(asset_response(path, content.data.into_owned()));
    }

    if !path.contains('.')
        && let Some(content) = Assets::get("index.html")
    {
        return Some(asset_response("index.html", content.data.into_owned()));
    }

    None
}

fn asset_response(path: &str, data: Vec<u8>) -> Response {
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();

    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            HeaderValue::from_str(&mime)
                .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
        )
        .body(Body::from(data))
        .expect("asset response")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serve_static_serves_index_without_content_encoding() {
        let response = serve_static("index.html");
        assert!(response.headers().get(header::CONTENT_ENCODING).is_none());
    }

    #[test]
    fn try_serve_static_returns_none_for_missing_asset_with_extension() {
        assert!(try_serve_static("file-icons/does-not-exist.svg").is_none());
    }

    #[test]
    fn try_serve_static_serves_file_icons_when_embedded() {
        let response = try_serve_static("file-icons/file.svg");
        assert!(response.is_some());
        assert_eq!(
            response
                .expect("file icon")
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("image/svg+xml")
        );
    }
}
