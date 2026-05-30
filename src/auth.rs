use axum::body::Body;
use axum::extract::State;
use axum::http::{Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::transport::AppState;

pub const SESSION_COOKIE_NAME: &str = "zfiles_session";

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub required: bool,
    pub token: Option<String>,
    pub expires_at: Option<i64>,
}

impl AuthConfig {
    pub fn disabled() -> Self {
        Self {
            required: false,
            token: None,
            expires_at: None,
        }
    }

    pub fn with_token(token: String, expires_at: Option<i64>) -> Self {
        Self {
            required: true,
            token: Some(token),
            expires_at,
        }
    }
}

pub fn generate_token() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

pub fn is_public_path(path: &str) -> bool {
    path.starts_with("/assets/") || path.starts_with("/file-icons/") || path == "/favicon.ico"
}

pub async fn read_only_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    if !state.read_only {
        return Ok(next.run(request).await);
    }

    if matches!(
        request.method(),
        &Method::POST | &Method::PATCH | &Method::PUT | &Method::DELETE
    ) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}

pub async fn middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let auth = &state.auth;
    if !auth.required {
        return next.run(request).await;
    }

    if is_public_path(request.uri().path()) {
        return next.run(request).await;
    }

    let Some(expected) = auth.token.as_deref() else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };

    let secure = request_is_secure(&request);
    let query_token = request.uri().query().and_then(token_from_query);
    let had_session_cookie = token_from_cookie(&request).is_some();

    let Some(provided) = token_from_authorization(&request)
        .or_else(|| query_token.clone())
        .or_else(|| token_from_cookie(&request))
    else {
        return unauthorized_response(secure, false);
    };

    if !constant_time_eq(provided.as_bytes(), expected.as_bytes()) {
        return unauthorized_response(secure, had_session_cookie);
    }

    if let Some(expires_at) = auth.expires_at {
        let now = current_unix_time();
        if now >= expires_at {
            return unauthorized_response(secure, had_session_cookie);
        }

        if !state.state.session_valid(&provided).unwrap_or(false) {
            return unauthorized_response(secure, had_session_cookie);
        }
    }

    let bootstrap = query_token.is_some();
    let max_age = auth
        .expires_at
        .map(|expires_at| (expires_at - current_unix_time()).max(0) as u64);

    let mut response = next.run(request).await;
    if bootstrap {
        append_session_cookie(&mut response, expected, secure, max_age);
    }
    response
}

fn token_from_authorization(request: &Request<Body>) -> Option<String> {
    request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::to_string)
}

fn token_from_cookie(request: &Request<Body>) -> Option<String> {
    request
        .headers()
        .get(axum::http::header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(|header| cookie_value(header, SESSION_COOKIE_NAME))
}

pub fn cookie_value(header: &str, name: &str) -> Option<String> {
    header.split(';').find_map(|part| {
        let part = part.trim();
        let (key, value) = part.split_once('=')?;
        (key == name).then(|| value.to_string())
    })
}

fn append_session_cookie(response: &mut Response, token: &str, secure: bool, max_age: Option<u64>) {
    if let Ok(cookie) = session_cookie_header(token, secure, max_age) {
        response
            .headers_mut()
            .append(axum::http::header::SET_COOKIE, cookie);
    }
}

fn session_cookie_header(
    token: &str,
    secure: bool,
    max_age: Option<u64>,
) -> Result<axum::http::HeaderValue, axum::http::header::InvalidHeaderValue> {
    let mut value = format!("{SESSION_COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax");
    if secure {
        value.push_str("; Secure");
    }
    if let Some(max_age) = max_age {
        value.push_str(&format!("; Max-Age={max_age}"));
    }
    axum::http::HeaderValue::from_str(&value)
}

fn clear_session_cookie_header(secure: bool) -> axum::http::HeaderValue {
    let mut value = format!("{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    if secure {
        value.push_str("; Secure");
    }
    axum::http::HeaderValue::from_str(&value).expect("valid clear cookie")
}

fn unauthorized_response(secure: bool, clear_cookie: bool) -> Response {
    let mut response = StatusCode::UNAUTHORIZED.into_response();
    if clear_cookie {
        response.headers_mut().append(
            axum::http::header::SET_COOKIE,
            clear_session_cookie_header(secure),
        );
    }
    response
}

fn request_is_secure(request: &Request<Body>) -> bool {
    request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.eq_ignore_ascii_case("https"))
        || request.uri().scheme_str() == Some("https")
}

fn current_unix_time() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs() as i64)
}

fn token_from_query(query: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        (key == "token").then(|| value.to_string())
    })
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    left.iter()
        .zip(right.iter())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_time_eq_matches_and_rejects() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"ab"));
    }

    #[test]
    fn token_from_query_parses_token_param() {
        assert_eq!(
            token_from_query("token=abc123&other=1"),
            Some("abc123".into())
        );
        assert_eq!(token_from_query("other=1"), None);
    }

    #[test]
    fn cookie_value_parses_named_cookie() {
        assert_eq!(
            cookie_value("zfiles_session=abc123; other=1", SESSION_COOKIE_NAME),
            Some("abc123".into())
        );
        assert_eq!(cookie_value("other=1", SESSION_COOKIE_NAME), None);
    }

    #[test]
    fn generate_token_is_unprefixed_uuid_v4_hex() {
        let token = generate_token();
        assert!(!token.contains('-'));
        assert!(!token.starts_with("zfiles-"));
        assert_eq!(token.len(), 32);
        assert!(
            token
                .chars()
                .all(|ch| ch.is_ascii_hexdigit() && !ch.is_uppercase())
        );
    }

    #[test]
    fn generate_token_produces_distinct_values() {
        let first = generate_token();
        let second = generate_token();
        assert_ne!(first, second);
    }

    #[test]
    fn is_public_path_matches_embedded_assets() {
        assert!(is_public_path("/assets/index.js"));
        assert!(is_public_path("/file-icons/file.svg"));
        assert!(!is_public_path("/api/list"));
    }
}
