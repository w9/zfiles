use std::io::IsTerminal;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServeBanner {
    pub root: String,
    pub url: String,
    pub token: Option<String>,
    pub read_only: bool,
    pub auto_read_only: bool,
    pub state_dir: Option<String>,
    pub public_share: bool,
    pub share_note: Option<String>,
    pub vite_dev: Option<String>,
    pub qr: Option<String>,
}

struct Colors {
    enabled: bool,
}

impl Colors {
    fn detect() -> Self {
        Self {
            enabled: std::io::stdout().is_terminal(),
        }
    }

    fn wrap(&self, code: &str, text: &str) -> String {
        if self.enabled {
            format!("\x1b[{code}m{text}\x1b[0m")
        } else {
            text.to_string()
        }
    }

    fn header(&self, text: &str) -> String {
        self.wrap("1;32", text)
    }

    fn url(&self, text: &str) -> String {
        self.wrap("1;36", text)
    }

    fn dim(&self, text: &str) -> String {
        self.wrap("2", text)
    }

    /// Wrap `text` in an OSC 8 hyperlink so the URL is clickable in modern
    /// terminals; terminals without OSC 8 support silently show the plain text.
    fn hyperlink(&self, url: &str, text: &str) -> String {
        if self.enabled {
            format!("\x1b]8;;{url}\x1b\\{text}\x1b]8;;\x1b\\")
        } else {
            text.to_string()
        }
    }
}

/// Replace a leading `$HOME` path component with `~` for compact display.
fn shorten_home(path: &str, home: Option<&str>) -> String {
    let Some(home) = home.filter(|h| !h.is_empty()) else {
        return path.to_string();
    };
    let home = home.trim_end_matches('/');
    if path == home {
        return "~".to_string();
    }
    if let Some(rest) = path.strip_prefix(home)
        && rest.starts_with('/')
    {
        return format!("~{rest}");
    }
    path.to_string()
}

const LABEL_WIDTH: usize = 10;

/// Right-aligned label, colon, left-aligned value (e.g. `Serving:  /path`).
fn label_row(label: &str, value: &str) -> String {
    format!(
        "  {label:>width$}:  {value}",
        label = label,
        value = value,
        width = LABEL_WIDTH
    )
}

impl ServeBanner {
    pub fn lines(&self) -> Vec<String> {
        self.lines_with_colors(Colors { enabled: false })
    }

    fn lines_with_colors(&self, colors: Colors) -> Vec<String> {
        let home = std::env::var("HOME").ok();
        let mut lines = vec![
            colors.header(&format!("  zfiles v{VERSION}")),
            String::new(),
        ];

        let mode = if self.read_only {
            "read-only"
        } else {
            "read/write"
        };
        lines.push(colors.dim(&label_row(
            "Serving",
            &shorten_home(&self.root, home.as_deref()),
        )));
        lines.push(colors.dim(&label_row("Mode", mode)));
        if self.public_share {
            lines.push(colors.dim(&label_row("Access", "sharing on LAN")));
        } else if self.token.is_some() {
            lines.push(colors.dim(&label_row("Access", "token required")));
        }
        if self.public_share
            && let Some(token) = &self.token
        {
            lines.push(colors.dim(&label_row("Token", token)));
        }
        if let Some(note) = &self.share_note {
            lines.push(colors.dim(&label_row("Note", note)));
        }
        if let Some(vite_dev) = &self.vite_dev {
            if let Some(state_dir) = &self.state_dir {
                lines.push(colors.dim(&label_row(
                    "State",
                    &shorten_home(state_dir, home.as_deref()),
                )));
            }
            lines.push(colors.dim(&label_row(
                "Frontend",
                &format!("Vite dev proxy ({vite_dev})"),
            )));
        }

        lines.push(String::new());

        // Spotlight: the URL is the single bold, clickable line.
        let link = colors.hyperlink(&self.url, &colors.url(&self.url));
        lines.push(format!("  {}  {link}", colors.url("→")));

        // Shares render the QR inline, right under the link.
        if let Some(qr) = &self.qr {
            lines.push(String::new());
            lines.push(colors.dim("  Scan to open on another device:"));
            for row in qr.lines() {
                lines.push(format!("  {row}"));
            }
        }

        lines.push(String::new());
        lines.push("  Press Ctrl+C to stop.".to_string());

        lines
    }

    pub fn render(&self) -> String {
        let colors = Colors::detect();
        let mut output = String::from('\n');
        for line in self.lines_with_colors(colors) {
            output.push_str(&line);
            output.push('\n');
        }
        output.push('\n');
        output
    }

    pub fn print(&self) {
        print!("{}", self.render());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_banner() -> ServeBanner {
        ServeBanner {
            root: "/srv/share".to_string(),
            url: "http://127.0.0.1:9000/?token=abc123".to_string(),
            token: Some("abc123".to_string()),
            read_only: false,
            auto_read_only: false,
            state_dir: None,
            public_share: false,
            share_note: None,
            vite_dev: None,
            qr: None,
        }
    }

    fn colored_lines(banner: &ServeBanner) -> Vec<String> {
        banner.lines_with_colors(Colors { enabled: true })
    }

    #[test]
    fn header_shows_version_without_running_suffix() {
        let rendered = sample_banner().render();
        assert!(rendered.contains(&format!("zfiles v{VERSION}")));
        assert!(!rendered.contains("is running"));
        assert!(rendered.contains("Press Ctrl+C to stop."));
        assert!(!rendered.contains('┌'));
    }

    #[test]
    fn url_is_spotlighted_with_arrow_marker_and_no_label_row() {
        let lines = sample_banner().lines();
        let url_line = lines
            .iter()
            .find(|line| line.contains("http://127.0.0.1:9000/?token=abc123"))
            .expect("url line");
        assert!(url_line.trim_start().starts_with('→'));
        assert!(!lines.iter().any(|line| line.contains("▸  Local:")));
        assert!(!lines.iter().any(|line| line.contains("▸  Share:")));
        assert!(!lines.iter().any(|line| line.contains('▸')));
    }

    #[test]
    fn url_line_is_an_osc8_hyperlink_when_colors_enabled() {
        let lines = colored_lines(&sample_banner());
        let url_line = lines
            .iter()
            .find(|line| line.contains("http://127.0.0.1:9000/?token=abc123"))
            .expect("url line");
        assert!(url_line.contains("\x1b]8;;http://127.0.0.1:9000/?token=abc123\x1b\\"));
        assert!(url_line.contains("\x1b]8;;\x1b\\"));
    }

    #[test]
    fn local_meta_uses_label_rows_before_url() {
        let lines = sample_banner().lines();
        let url_idx = lines
            .iter()
            .position(|line| line.contains("http://127.0.0.1:9000/?token=abc123"))
            .expect("url line");
        let serving_idx = lines
            .iter()
            .position(|line| line.contains("Serving:") && line.contains("/srv/share"))
            .expect("serving row");
        let mode_idx = lines
            .iter()
            .position(|line| line.contains("Mode:") && line.contains("read/write"))
            .expect("mode row");
        let access_idx = lines
            .iter()
            .position(|line| line.contains("Access:") && line.contains("token required"))
            .expect("access row");
        assert!(serving_idx < url_idx);
        assert!(mode_idx < url_idx);
        assert!(access_idx < url_idx);
        assert!(
            !lines
                .iter()
                .any(|line| line.contains("Token:") && line.contains("abc123"))
        );
        assert!(!lines.iter().any(|line| line.contains('·')));
    }

    #[test]
    fn read_only_meta_reports_read_only() {
        let banner = ServeBanner {
            read_only: true,
            auto_read_only: true,
            ..sample_banner()
        };
        assert!(
            banner
                .lines()
                .iter()
                .any(|line| { line.contains("Mode:") && line.contains("read-only") })
        );
    }

    #[test]
    fn share_banner_lists_token_row_lan_access_and_inline_qr_after_url() {
        let banner = ServeBanner {
            url: "http://192.168.0.5:8080/?token=abc123".to_string(),
            public_share: true,
            qr: Some("█▀█\n▀ ▀".to_string()),
            ..sample_banner()
        };
        let lines = banner.lines();
        let url_idx = lines
            .iter()
            .position(|line| line.contains("http://192.168.0.5:8080"))
            .expect("url line");
        let access_idx = lines
            .iter()
            .position(|line| line.contains("Access:") && line.contains("sharing on LAN"))
            .expect("access row");
        let token_idx = lines
            .iter()
            .position(|line| line.contains("Token:") && line.contains("abc123"))
            .expect("token row");
        let qr_idx = lines
            .iter()
            .position(|line| line.contains("█▀█"))
            .expect("qr row");
        assert!(access_idx < url_idx);
        assert!(token_idx < url_idx);
        assert!(qr_idx > url_idx);
        assert!(
            lines
                .iter()
                .any(|line| line.contains("Scan to open on another device"))
        );
        assert!(!lines.iter().any(|line| line.contains("▸  QR:")));
    }

    #[test]
    fn public_share_banner_can_explain_share_host_fallback() {
        let banner = ServeBanner {
            public_share: true,
            share_note: Some(
                "could not detect a LAN IP for 0.0.0.0; using localhost for the share URL"
                    .to_string(),
            ),
            ..sample_banner()
        };
        let lines = banner.lines();
        assert!(lines.iter().any(|line| line.contains("Note:")));
        assert!(
            lines
                .iter()
                .any(|line| line.contains("could not detect a LAN IP"))
        );
    }

    #[test]
    fn tokenless_banner_omits_access_and_token_rows() {
        let banner = ServeBanner {
            url: "http://127.0.0.1:9000/".to_string(),
            token: None,
            ..sample_banner()
        };
        let lines = banner.lines();
        assert!(!lines.iter().any(|line| line.contains("Access:")));
        assert!(!lines.iter().any(|line| line.contains("Token:")));
    }

    #[test]
    fn dev_rows_use_state_and_frontend_labels() {
        let banner = ServeBanner {
            url: "http://127.0.0.1:9000/".to_string(),
            token: None,
            state_dir: Some("/srv/zfiles-state".to_string()),
            vite_dev: Some("http://127.0.0.1:5173".to_string()),
            ..sample_banner()
        };
        let lines = banner.lines();
        let url_idx = lines
            .iter()
            .position(|line| line.contains("http://127.0.0.1:9000/"))
            .expect("url line");
        let state_idx = lines
            .iter()
            .position(|line| line.contains("State:") && line.contains("/srv/zfiles-state"))
            .expect("state row");
        let frontend_idx = lines
            .iter()
            .position(|line| {
                line.contains("Frontend:")
                    && line.contains("Vite dev proxy (http://127.0.0.1:5173)")
            })
            .expect("frontend row");
        assert!(state_idx < url_idx);
        assert!(frontend_idx < url_idx);
    }

    #[test]
    fn label_row_right_aligns_labels_before_colon() {
        let row = super::label_row("Frontend", "Vite dev proxy");
        assert!(row.ends_with("Frontend:  Vite dev proxy"));
        assert!(row.starts_with("  "));
    }

    #[test]
    fn shorten_home_replaces_home_prefix_with_tilde() {
        assert_eq!(
            shorten_home("/home/me/.config/zfiles", Some("/home/me")),
            "~/.config/zfiles"
        );
        assert_eq!(shorten_home("/home/me", Some("/home/me/")), "~");
        assert_eq!(shorten_home("/srv/data", Some("/home/me")), "/srv/data");
        // A sibling sharing a prefix must not be mistaken for the home dir.
        assert_eq!(
            shorten_home("/home/median/x", Some("/home/me")),
            "/home/median/x"
        );
        assert_eq!(shorten_home("/home/me/x", None), "/home/me/x");
    }

    #[test]
    fn render_adds_blank_lines_before_and_after_banner() {
        let rendered = sample_banner().render();
        assert!(rendered.starts_with('\n'));
        assert!(rendered.ends_with("\n\n"));
    }

    #[test]
    fn plain_lines_contain_no_ansi_or_osc_sequences() {
        let rendered = sample_banner().lines().join("\n");
        assert!(!rendered.contains("\x1b["));
        assert!(!rendered.contains("\x1b]8"));
    }
}
