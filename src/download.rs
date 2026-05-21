use std::path::Path;

use axum::body::Body;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

pub const READ_BUFFER_BYTES: usize = 256 * 1024;

pub async fn file_body(path: &Path, start: u64, length: u64) -> std::io::Result<Body> {
    let mut file = File::open(path).await?;
    file.seek(std::io::SeekFrom::Start(start)).await?;
    let reader = file.take(length);
    Ok(Body::from_stream(ReaderStream::with_capacity(
        reader,
        READ_BUFFER_BYTES,
    )))
}

#[cfg(target_os = "linux")]
pub mod linux {
    use std::os::unix::net::UnixStream;
    use std::path::Path;

    use nix::sys::sendfile::sendfile;

    /// Transfer bytes from `path` to `writer` using `sendfile(2)`.
    pub fn sendfile_to_writer(
        path: &Path,
        start: u64,
        length: u64,
        writer: &UnixStream,
    ) -> std::io::Result<u64> {
        let file = std::fs::File::open(path)?;
        let mut offset = start as i64;
        let mut sent = 0u64;

        while sent < length {
            let to_send = length
                .saturating_sub(sent)
                .min(super::READ_BUFFER_BYTES as u64) as usize;
            let written = sendfile(writer, &file, Some(&mut offset), to_send)
                .map_err(std::io::Error::other)?;

            if written == 0 {
                break;
            }

            sent += written as u64;
        }

        Ok(sent)
    }

    #[test]
    fn sendfile_moves_bytes() {
        use std::io::Read;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sample.bin");
        std::fs::write(&path, b"0123456789").unwrap();

        let (mut reader, writer) = UnixStream::pair().unwrap();
        let handle = std::thread::spawn(move || {
            sendfile_to_writer(&path, 2, 4, &writer).unwrap();
        });

        let mut output = Vec::new();
        reader.read_to_end(&mut output).unwrap();
        handle.join().unwrap();
        assert_eq!(output, b"2345");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn file_body_returns_requested_bytes() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("sample.bin");
        std::fs::write(&path, b"hello world").unwrap();

        let body = file_body(&path, 6, 5).await.unwrap();
        let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
        assert_eq!(&bytes[..], b"world");
    }
}
