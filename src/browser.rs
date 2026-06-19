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
    share_host: Option<&str>,
) -> PublicShareUrl {
    public_share_url_with_resolvers(
        bound,
        token,
        lang,
        share_host,
        machine_hostname,
        default_route_ipv4,
    )
}

fn public_share_url_with_resolvers<F, G>(
    bound: &SocketAddr,
    token: Option<&str>,
    lang: Option<&str>,
    share_host: Option<&str>,
    machine_hostname: F,
    default_route_ipv4: G,
) -> PublicShareUrl
where
    F: FnOnce() -> Option<String>,
    G: FnOnce() -> Option<Ipv4Addr>,
{
    let (display_host, note) = match bound.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => resolve_wildcard_share_host(
            bound.port(),
            share_host,
            machine_hostname,
            default_route_ipv4,
        ),
        _ => (bound.to_string(), None),
    };

    PublicShareUrl {
        url: locale::share_url(&display_host, token, lang),
        note,
    }
}

fn resolve_wildcard_share_host<F, G>(
    port: u16,
    share_host: Option<&str>,
    machine_hostname: F,
    default_route_ipv4: G,
) -> (String, Option<String>)
where
    F: FnOnce() -> Option<String>,
    G: FnOnce() -> Option<Ipv4Addr>,
{
    if let Some(host) = share_host.map(str::trim).filter(|host| !host.is_empty()) {
        return (format!("{host}:{port}"), None);
    }

    if let Some(hostname) = machine_hostname()
        .map(|hostname| hostname.trim().to_string())
        .filter(|hostname| !hostname.is_empty())
    {
        return (format!("{hostname}:{port}"), None);
    }

    if let Some(ip) = default_route_ipv4() {
        return (format!("{ip}:{port}"), None);
    }

    (
        format!("{}:{port}", Ipv4Addr::LOCALHOST),
        Some(
            "could not detect a LAN IP for 0.0.0.0; using localhost for the share URL".to_string(),
        ),
    )
}

fn machine_hostname() -> Option<String> {
    std::env::var("HOSTNAME").ok()
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

    fn wildcard(port: u16) -> SocketAddr {
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, port))
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
        let share = public_share_url_with_resolvers(
            &wildcard(8080),
            Some("a1b2c3d4e5f6789012345678abcdef01"),
            Some("zh-CN"),
            None,
            || None,
            || Some(Ipv4Addr::new(192, 168, 1, 23)),
        );

        assert_eq!(
            share.url,
            "http://192.168.1.23:8080/?token=a1b2c3d4e5f6789012345678abcdef01&lang=zh-CN"
        );
        assert_eq!(share.note, None);
    }

    #[test]
    fn public_share_url_prefers_cli_share_host_on_wildcard_bind() {
        let share = public_share_url_with_resolvers(
            &wildcard(8080),
            Some("a1b2c3d4e5f6789012345678abcdef01"),
            None,
            Some("share.example"),
            || Some("machine.local".to_string()),
            || Some(Ipv4Addr::new(192, 168, 1, 23)),
        );

        assert_eq!(
            share.url,
            "http://share.example:8080/?token=a1b2c3d4e5f6789012345678abcdef01"
        );
        assert_eq!(share.note, None);
    }

    #[test]
    fn public_share_url_falls_back_to_machine_hostname_before_external_ip() {
        let share = public_share_url_with_resolvers(
            &wildcard(8080),
            None,
            None,
            None,
            || Some("mybox.local".to_string()),
            || Some(Ipv4Addr::new(192, 168, 1, 23)),
        );

        assert_eq!(share.url, "http://mybox.local:8080/");
        assert_eq!(share.note, None);
    }

    #[test]
    fn public_share_url_falls_back_to_localhost_when_ipv4_detection_fails() {
        let share =
            public_share_url_with_resolvers(&wildcard(8080), None, None, None, || None, || None);

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
        let share = public_share_url_with_resolvers(
            &bound,
            None,
            None,
            Some("ignored.example"),
            || Some("machine.local".to_string()),
            || Some(Ipv4Addr::new(192, 168, 1, 23)),
        );

        assert_eq!(share.url, "http://192.168.1.50:8080/");
        assert_eq!(share.note, None);
    }

    #[test]
    fn wildcard_bind_explorer_url_stays_raw_while_share_url_is_browser_safe() {
        let bound = wildcard(8080);
        let explorer = open_url(&bound, None, None);
        let share = public_share_url_with_resolvers(
            &bound,
            None,
            None,
            None,
            || None,
            || Some(Ipv4Addr::new(192, 168, 1, 23)),
        );

        assert_eq!(explorer, "http://0.0.0.0:8080/");
        assert_eq!(share.url, "http://192.168.1.23:8080/");
        assert!(!share.url.contains("0.0.0.0"));
    }
}
