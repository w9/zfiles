use axum::body::Body;
use axum::extract::State;
use axum::http::{Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::transport::AppState;

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
    use std::time::{SystemTime, UNIX_EPOCH};

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());

    format!("zfiles-{nanos:x}")
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
) -> Result<Response, StatusCode> {
    let auth = &state.auth;
    if !auth.required {
        return Ok(next.run(request).await);
    }

    let expected = auth
        .token
        .as_deref()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let provided = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !constant_time_eq(provided.as_bytes(), expected.as_bytes()) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    if let Some(expires_at) = auth.expires_at {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |duration| duration.as_secs() as i64);
        if now >= expires_at {
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    if !state
        .state
        .session_valid(provided)
        .unwrap_or(false)
    {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(request).await)
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
}
