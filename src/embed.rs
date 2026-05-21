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
    let path = path.trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some(content) = Assets::get(path) {
        return asset_response(path, content.data.into_owned());
    }

    if !path.contains('.')
        && let Some(content) = Assets::get("index.html")
    {
        return asset_response("index.html", content.data.into_owned());
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(FALLBACK_INDEX))
        .expect("fallback index response")
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
