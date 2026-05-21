use anyhow::{Context, Result, bail};
use serde_json::Value;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

pub async fn write_message(writer: &mut (impl AsyncWrite + Unpin), message: &Value) -> Result<()> {
    let payload = serde_json::to_vec(message)?;
    let header = format!("Content-Length: {}\r\n\r\n", payload.len());
    writer.write_all(header.as_bytes()).await?;
    writer.write_all(&payload).await?;
    writer.flush().await?;
    Ok(())
}

pub async fn read_message(reader: &mut (impl AsyncRead + Unpin)) -> Result<Value> {
    let mut header = Vec::new();
    let mut window = [0u8; 1];

    while header.len() < 8192 {
        let read = reader.read(&mut window).await?;
        if read == 0 {
            bail!("unexpected EOF while reading plugin header");
        }
        header.push(window[0]);
        if header.ends_with(b"\r\n\r\n") {
            break;
        }
    }

    let header_text = std::str::from_utf8(&header).context("invalid plugin header encoding")?;
    let mut content_length = None;

    for line in header_text.lines() {
        let Some(value) = line.strip_prefix("Content-Length:") else {
            continue;
        };
        content_length = Some(
            value
                .trim()
                .parse::<usize>()
                .context("invalid Content-Length")?,
        );
        break;
    }

    let content_length =
        content_length.ok_or_else(|| anyhow::anyhow!("missing Content-Length header"))?;

    let mut payload = vec![0u8; content_length];
    reader.read_exact(&mut payload).await?;
    let value = serde_json::from_slice(&payload).context("invalid plugin JSON payload")?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::duplex;

    #[tokio::test]
    async fn round_trip_message() {
        let (mut client, mut server) = duplex(1024);
        let message = json!({"jsonrpc":"2.0","id":1,"method":"initialize"});

        let expected = message.clone();
        tokio::spawn(async move {
            write_message(&mut client, &message).await.unwrap();
        });

        let decoded = read_message(&mut server).await.unwrap();
        assert_eq!(decoded, expected);
    }
}
