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

pub fn serve_static(path: &str, accept_encoding: Option<&str>) -> Response {
    let path = path.trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some((encoding, data)) = select_encoded_asset(path, accept_encoding) {
        return asset_response(path, data, Some(encoding));
    }

    if let Some(content) = Assets::get(path) {
        return asset_response(path, content.data.into_owned(), None);
    }

    if !path.contains('.')
        && let Some((encoding, data)) = select_encoded_asset("index.html", accept_encoding)
    {
        return asset_response("index.html", data, Some(encoding));
    }

    if !path.contains('.')
        && let Some(content) = Assets::get("index.html")
    {
        return asset_response("index.html", content.data.into_owned(), None);
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(FALLBACK_INDEX))
        .expect("fallback index response")
}

fn select_encoded_asset(path: &str, accept_encoding: Option<&str>) -> Option<(&'static str, Vec<u8>)> {
    let accept = accept_encoding?;
    let br_path = format!("{path}.br");
    let gz_path = format!("{path}.gz");
    if accept.contains("br")
        && let Some(content) = Assets::get(br_path.as_str())
    {
        return Some(("br", content.data.into_owned()));
    }
    if accept.contains("gzip")
        && let Some(content) = Assets::get(gz_path.as_str())
    {
        return Some(("gzip", content.data.into_owned()));
    }
    None
}

fn asset_response(path: &str, data: Vec<u8>, encoding: Option<&'static str>) -> Response {
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();

    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            HeaderValue::from_str(&mime)
                .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
        );

    if let Some(encoding) = encoding {
        builder = builder.header(
            header::CONTENT_ENCODING,
            HeaderValue::from_static(encoding),
        );
    }

    builder
        .body(Body::from(data))
        .expect("asset response")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_brotli_when_accepted() {
        let response = serve_static("index.html", Some("br, gzip"));
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_ENCODING)
                .and_then(|value| value.to_str().ok()),
            Some("br")
        );
    }

    #[test]
    fn falls_back_to_uncompressed_without_accept_encoding() {
        let response = serve_static("index.html", None);
        assert!(response.headers().get(header::CONTENT_ENCODING).is_none());
    }
}
