use std::path::Path;

use anyhow::{Context, Result, bail};
use base64::Engine;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue, LOCATION};
use serde::{Deserialize, Serialize};

const CHUNK_SIZE: usize = 256 * 1024;

#[derive(Debug, Serialize, Deserialize)]
struct UploadState {
    location: String,
}

pub struct UploadOptions<'a> {
    pub server: &'a str,
    pub file: &'a Path,
    pub target_path: &'a str,
    pub token: Option<&'a str>,
    pub resume: bool,
}

pub async fn upload_file(options: UploadOptions<'_>) -> Result<()> {
    let metadata = tokio::fs::metadata(options.file)
        .await
        .with_context(|| format!("stat {}", options.file.display()))?;
    let upload_length = metadata.len();
    let client = reqwest::Client::new();

    let location = if options.resume {
        if let Some(state) = read_state(options.file)? {
            state.location
        } else {
            create_upload(
                &client,
                options.server,
                options.target_path,
                upload_length,
                options.token,
            )
            .await?
        }
    } else {
        create_upload(
            &client,
            options.server,
            options.target_path,
            upload_length,
            options.token,
        )
        .await?
    };

    write_state(options.file, &location)?;

    let mut offset = head_offset(&client, &location, options.token).await?;
    let mut file = tokio::fs::File::open(options.file)
        .await
        .with_context(|| format!("open {}", options.file.display()))?;
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    file.seek(std::io::SeekFrom::Start(offset)).await?;

    while offset < upload_length {
        let to_read = CHUNK_SIZE.min((upload_length - offset) as usize);
        let mut chunk = vec![0u8; to_read];
        let read = file.read(&mut chunk).await.context("read upload chunk")?;
        if read == 0 {
            break;
        }
        chunk.truncate(read);

        let mut patch_headers = auth_headers(options.token);
        patch_headers.insert(
            "Upload-Offset",
            HeaderValue::from_str(&offset.to_string()).context("upload offset header")?,
        );
        patch_headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("application/offset+octet-stream"),
        );

        let patch = client
            .patch(&location)
            .headers(patch_headers)
            .body(chunk)
            .send()
            .await
            .context("patch upload")?;

        if !patch.status().is_success() {
            bail!("upload patch failed: HTTP {}", patch.status());
        }

        offset = patch
            .headers()
            .get("Upload-Offset")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse().ok())
            .unwrap_or(offset + read as u64);
    }

    clear_state(options.file)?;
    Ok(())
}

async fn create_upload(
    client: &reqwest::Client,
    server: &str,
    target_path: &str,
    upload_length: u64,
    token: Option<&str>,
) -> Result<String> {
    let mut headers = auth_headers(token);
    headers.insert(
        "Upload-Length",
        HeaderValue::from_str(&upload_length.to_string()).context("upload length header")?,
    );
    headers.insert(
        "Upload-Metadata",
        HeaderValue::from_str(&format!(
            "filename {}",
            base64::engine::general_purpose::STANDARD.encode(target_path)
        ))
        .context("upload metadata header")?,
    );

    let create_url = format!("{}/api/upload", server.trim_end_matches('/'));
    let create = client
        .post(create_url)
        .headers(headers)
        .send()
        .await
        .context("create upload")?;

    if !create.status().is_success() {
        bail!("upload create failed: HTTP {}", create.status());
    }

    create
        .headers()
        .get(LOCATION)
        .and_then(|value| value.to_str().ok())
        .map(|value| resolve_location(server, value))
        .context("upload create missing location header")
}

async fn head_offset(client: &reqwest::Client, location: &str, token: Option<&str>) -> Result<u64> {
    let head = client
        .head(location)
        .headers(auth_headers(token))
        .send()
        .await
        .context("head upload")?;
    Ok(head
        .headers()
        .get("Upload-Offset")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .unwrap_or(0))
}

fn state_path(file: &Path) -> std::path::PathBuf {
    file.with_extension("zfiles-upload.json")
}

fn read_state(file: &Path) -> Result<Option<UploadState>> {
    let path = state_path(file);
    if !path.is_file() {
        return Ok(None);
    }
    let contents = std::fs::read_to_string(path).context("read upload state")?;
    Ok(Some(
        serde_json::from_str(&contents).context("parse upload state")?,
    ))
}

fn write_state(file: &Path, location: &str) -> Result<()> {
    let state = UploadState {
        location: location.to_string(),
    };
    std::fs::write(
        state_path(file),
        serde_json::to_string(&state).context("serialize upload state")?,
    )
    .context("write upload state")
}

fn clear_state(file: &Path) -> Result<()> {
    let path = state_path(file);
    if path.is_file() {
        std::fs::remove_file(path).context("remove upload state")?;
    }
    Ok(())
}

fn auth_headers(token: Option<&str>) -> HeaderMap {
    let mut headers = HeaderMap::new();
    if let Some(token) = token {
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("bearer token fits in header"),
        );
    }
    headers
}

fn resolve_location(server: &str, location: &str) -> String {
    if location.starts_with("http://") || location.starts_with("https://") {
        return location.to_string();
    }
    format!("{}{}", server.trim_end_matches('/'), location)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_relative_location() {
        assert_eq!(
            resolve_location("http://localhost:8080", "/api/upload/abc"),
            "http://localhost:8080/api/upload/abc"
        );
    }
}
