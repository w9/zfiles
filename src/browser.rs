use std::net::SocketAddr;

use crate::locale;

pub fn open_url(bound: &SocketAddr, token: Option<&str>, lang: Option<&str>) -> String {
    locale::share_url(&bound.to_string(), token, lang)
}

pub fn open_async(url: String) {
    tokio::spawn(async move {
        let result = tokio::process::Command::new("xdg-open")
            .arg(url)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();

        if let Err(error) = result {
            tracing::warn!(%error, "failed to spawn browser");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, SocketAddr};

    fn localhost(port: u16) -> SocketAddr {
        SocketAddr::from((Ipv4Addr::LOCALHOST, port))
    }

    #[test]
    fn open_url_without_token() {
        assert_eq!(
            open_url(&localhost(8765), None, None),
            "http://127.0.0.1:8765/"
        );
    }

    #[test]
    fn open_url_with_token() {
        assert_eq!(
            open_url(&localhost(8765), Some("a1b2c3d4e5f6789012345678abcdef01"), None),
            "http://127.0.0.1:8765/?token=a1b2c3d4e5f6789012345678abcdef01"
        );
    }

    #[test]
    fn open_url_with_lang() {
        assert_eq!(
            open_url(&localhost(8765), None, Some("zh-CN")),
            "http://127.0.0.1:8765/?lang=zh-CN"
        );
    }
}
