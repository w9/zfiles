use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};

use crate::locale;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicShareUrl {
    pub url: String,
    pub note: Option<String>,
}

pub fn open_url(bound: &SocketAddr, token: Option<&str>, lang: Option<&str>) -> String {
    locale::share_url(&bound.to_string(), token, lang)
}

pub fn public_share_url(
    bound: &SocketAddr,
    token: Option<&str>,
    lang: Option<&str>,
) -> PublicShareUrl {
    public_share_url_with_default_route(bound, token, lang, default_route_ipv4)
}

fn public_share_url_with_default_route<F>(
    bound: &SocketAddr,
    token: Option<&str>,
    lang: Option<&str>,
    default_route_ipv4: F,
) -> PublicShareUrl
where
    F: FnOnce() -> Option<Ipv4Addr>,
{
    let (display_addr, note) = match bound.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => match default_route_ipv4() {
            Some(ip) => (SocketAddr::from((IpAddr::V4(ip), bound.port())), None),
            None => (
                SocketAddr::from((IpAddr::V4(Ipv4Addr::LOCALHOST), bound.port())),
                Some(
                    "could not detect a LAN IP for 0.0.0.0; using localhost for the share URL"
                        .to_string(),
                ),
            ),
        },
        _ => (*bound, None),
    };

    PublicShareUrl {
        url: locale::share_url(&display_addr.to_string(), token, lang),
        note,
    }
}

fn default_route_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(8, 8, 8, 8), 80)).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) if !ip.is_unspecified() && !ip.is_loopback() => Some(ip),
        _ => None,
    }
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
            open_url(
                &localhost(8765),
                Some("a1b2c3d4e5f6789012345678abcdef01"),
                None
            ),
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

    #[test]
    fn public_share_url_replaces_ipv4_wildcard_with_default_route_ipv4() {
        let bound = SocketAddr::from((Ipv4Addr::UNSPECIFIED, 8080));
        let share = public_share_url_with_default_route(
            &bound,
            Some("a1b2c3d4e5f6789012345678abcdef01"),
            Some("zh-CN"),
            || Some(Ipv4Addr::new(192, 168, 1, 23)),
        );

        assert_eq!(
            share.url,
            "http://192.168.1.23:8080/?token=a1b2c3d4e5f6789012345678abcdef01&lang=zh-CN"
        );
        assert_eq!(share.note, None);
    }

    #[test]
    fn public_share_url_falls_back_to_localhost_when_ipv4_detection_fails() {
        let bound = SocketAddr::from((Ipv4Addr::UNSPECIFIED, 8080));
        let share = public_share_url_with_default_route(&bound, None, None, || None);

        assert_eq!(share.url, "http://127.0.0.1:8080/");
        assert_eq!(
            share.note,
            Some(
                "could not detect a LAN IP for 0.0.0.0; using localhost for the share URL"
                    .to_string()
            )
        );
    }

    #[test]
    fn public_share_url_keeps_specific_bind_address() {
        let bound = SocketAddr::from((Ipv4Addr::new(192, 168, 1, 50), 8080));
        let share = public_share_url_with_default_route(&bound, None, None, || {
            Some(Ipv4Addr::new(192, 168, 1, 23))
        });

        assert_eq!(share.url, "http://192.168.1.50:8080/");
        assert_eq!(share.note, None);
    }

    #[test]
    fn wildcard_bind_explorer_url_stays_raw_while_share_url_is_browser_safe() {
        let bound = SocketAddr::from((Ipv4Addr::UNSPECIFIED, 8080));
        let explorer = open_url(&bound, None, None);
        let share = public_share_url_with_default_route(&bound, None, None, || {
            Some(Ipv4Addr::new(192, 168, 1, 23))
        });

        assert_eq!(explorer, "http://0.0.0.0:8080/");
        assert_eq!(share.url, "http://192.168.1.23:8080/");
        assert!(!share.url.contains("0.0.0.0"));
    }
}
