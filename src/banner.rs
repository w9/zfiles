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
    pub vite_dev: Option<String>,
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
        self.wrap("36", text)
    }

    fn dim(&self, text: &str) -> String {
        self.wrap("2", text)
    }
}

const LABEL_WIDTH: usize = 10;

fn arrow_row(label: &str, value: &str) -> String {
    format!("  ▸  {label:<width$}{value}", width = LABEL_WIDTH)
}

impl ServeBanner {
    pub fn lines(&self) -> Vec<String> {
        self.lines_with_colors(Colors { enabled: false })
    }

    fn lines_with_colors(&self, colors: Colors) -> Vec<String> {
        let header = format!("  zfiles v{VERSION} is running");
        let mut lines = vec![colors.header(&header), String::new()];

        let url_label = if self.public_share {
            "Share:"
        } else {
            "Local:"
        };
        lines.push(arrow_row(url_label, &colors.url(&self.url)));

        if let Some(token) = &self.token {
            lines.push(arrow_row("Token:", token));
        }

        lines.push(arrow_row("Serving:", &self.root));

        if self.token.is_some() {
            lines.push(arrow_row("Access:", "token required"));
        }

        let mode = if self.read_only {
            "read-only"
        } else {
            "read/write"
        };
        lines.push(arrow_row("Mode:", mode));

        if self.public_share {
            lines.push(arrow_row("QR:", "scan below"));
        }

        if self.vite_dev.is_some() {
            if let Some(state_dir) = &self.state_dir {
                lines.push(colors.dim(&arrow_row("State:", state_dir)));
            }
            if let Some(vite_dev) = &self.vite_dev {
                lines.push(colors.dim(&arrow_row(
                    "Frontend:",
                    &format!("Vite dev proxy ({vite_dev})"),
                )));
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
            root: "/tmp/share".to_string(),
            url: "http://127.0.0.1:9000/?token=abc123".to_string(),
            token: Some("abc123".to_string()),
            read_only: false,
            auto_read_only: false,
            state_dir: None,
            public_share: false,
            vite_dev: None,
        }
    }

    #[test]
    fn local_banner_includes_version_header_and_url() {
        let rendered = sample_banner().render();
        assert!(rendered.contains(&format!("zfiles v{VERSION} is running")));
        assert!(rendered.contains("▸  Local:"));
        assert!(rendered.contains("http://127.0.0.1:9000/?token=abc123"));
        assert!(rendered.contains("▸  Token:"));
        assert!(rendered.contains("abc123"));
        assert!(rendered.contains("▸  Access:"));
        assert!(rendered.contains("token required"));
        assert!(rendered.contains("▸  Mode:"));
        assert!(rendered.contains("read/write"));
        assert!(rendered.contains("Press Ctrl+C to stop."));
        assert!(!rendered.contains('┌'));
    }

    #[test]
    fn read_only_banner_reports_mode() {
        let banner = ServeBanner {
            read_only: true,
            auto_read_only: true,
            ..sample_banner()
        };
        let rendered = banner.render();
        assert!(rendered.contains("▸  Mode:"));
        assert!(rendered.contains("read-only"));
    }

    #[test]
    fn public_share_banner_uses_share_label_and_qr_hint() {
        let banner = ServeBanner {
            url: "http://192.168.0.5:8080/?token=abc123".to_string(),
            public_share: true,
            ..sample_banner()
        };
        let rendered = banner.render();
        assert!(rendered.contains("▸  Share:"));
        assert!(rendered.contains("▸  QR:"));
        assert!(rendered.contains("scan below"));
        assert!(!rendered.contains("▸  Local:"));
    }

    #[test]
    fn tokenless_banner_omits_token_and_access_rows() {
        let banner = ServeBanner {
            url: "http://127.0.0.1:9000/".to_string(),
            token: None,
            ..sample_banner()
        };
        let rendered = banner.render();
        assert!(!rendered.contains("▸  Token:"));
        assert!(!rendered.contains("▸  Access:"));
    }

    #[test]
    fn dev_frontend_banner_lists_dimmed_state_and_frontend_rows() {
        let banner = ServeBanner {
            url: "http://127.0.0.1:9000/".to_string(),
            token: None,
            state_dir: Some("/tmp/zfiles-state".to_string()),
            vite_dev: Some("http://127.0.0.1:5173".to_string()),
            ..sample_banner()
        };
        let lines = banner.lines();
        let state = lines
            .iter()
            .find(|line| line.contains("State:"))
            .expect("state row");
        let frontend = lines
            .iter()
            .find(|line| line.contains("Frontend:"))
            .expect("frontend row");
        assert!(state.contains("/tmp/zfiles-state"));
        assert!(frontend.contains("Frontend: Vite dev proxy (http://127.0.0.1:5173)"));
    }

    #[test]
    fn arrow_row_puts_space_after_longest_label() {
        let row = super::arrow_row("Frontend:", "Vite dev proxy");
        assert!(row.ends_with("Frontend: Vite dev proxy"));
    }

    #[test]
    fn render_adds_blank_lines_before_and_after_banner() {
        let rendered = sample_banner().render();
        assert!(rendered.starts_with('\n'));
        assert!(rendered.ends_with("\n\n"));
    }

    #[test]
    fn plain_lines_contain_no_ansi_escape_codes() {
        let rendered = sample_banner().lines().join("\n");
        assert!(!rendered.contains("\x1b["));
    }
}
