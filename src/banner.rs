#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServeBanner {
    pub root: String,
    pub url: String,
    pub token: Option<String>,
    pub open_browser: bool,
    pub read_only: bool,
    pub auto_read_only: bool,
    pub state_dir: Option<String>,
    pub public_share: bool,
    pub vite_dev: Option<String>,
}

impl ServeBanner {
    pub fn lines(&self) -> Vec<String> {
        let mut lines = vec![
            "zfiles is running".to_string(),
            String::new(),
            if self.public_share {
                "Share on your network:".to_string()
            } else {
                "Open in your browser:".to_string()
            },
            format!("  {}", self.url),
        ];

        if let Some(token) = &self.token {
            lines.push(String::new());
            lines.push("Auth token (for API and CLI clients):".to_string());
            lines.push(format!("  {token}"));
        }

        lines.push(String::new());
        lines.push(format!("Serving: {}", self.root));

        if self.read_only {
            if self.auto_read_only {
                lines.push(
                    "Mode: read-only (served folder is not writable; uploads disabled)".to_string(),
                );
            } else {
                lines.push("Mode: read-only uploads disabled".to_string());
            }
        }

        if let Some(state_dir) = &self.state_dir {
            lines.push(format!("State: {state_dir}"));
        }

        if let Some(vite_dev) = &self.vite_dev {
            lines.push(format!("Frontend: Vite dev proxy ({vite_dev})"));
        }

        lines.push(String::new());
        if self.open_browser {
            lines.push("Opening your default browser…".to_string());
        } else {
            lines.push("Open the URL above in your browser.".to_string());
        }

        lines.push(String::new());
        lines.push("Press Ctrl+C to stop.".to_string());

        lines
    }

    pub fn render(&self) -> String {
        render_box(&self.lines())
    }

    pub fn print(&self) {
        print!("{}", self.render());
    }
}

pub fn render_box(lines: &[String]) -> String {
    let width = lines
        .iter()
        .map(|line| line.chars().count())
        .max()
        .unwrap_or(0)
        .max(24);
    let mut output = String::new();
    output.push('┌');
    output.extend(std::iter::repeat_n('─', width + 2));
    output.push('┐');
    output.push('\n');

    for line in lines {
        output.push('│');
        output.push(' ');
        output.push_str(line);
        let pad = width.saturating_sub(line.chars().count());
        output.extend(std::iter::repeat_n(' ', pad));
        output.push(' ');
        output.push('│');
        output.push('\n');
    }

    output.push('└');
    output.extend(std::iter::repeat_n('─', width + 2));
    output.push('┘');
    output.push('\n');
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_box_wraps_lines_with_borders() {
        let rendered = render_box(&[
            "zfiles is running".into(),
            "  http://127.0.0.1:8080/".into(),
        ]);
        assert!(rendered.starts_with("┌"));
        assert!(rendered.contains("│ zfiles is running"));
        assert!(rendered.ends_with("┘\n"));
    }

    #[test]
    fn tokenized_banner_includes_url_token_and_browser_hint() {
        let banner = ServeBanner {
            root: "/tmp/share".to_string(),
            url: "http://127.0.0.1:9000/?token=abc123".to_string(),
            token: Some("abc123".to_string()),
            open_browser: true,
            read_only: false,
            auto_read_only: false,
            state_dir: None,
            public_share: false,
            vite_dev: None,
        };
        let rendered = banner.render();
        assert!(rendered.contains("Open in your browser:"));
        assert!(rendered.contains("http://127.0.0.1:9000/?token=abc123"));
        assert!(rendered.contains("Auth token (for API and CLI clients):"));
        assert!(rendered.contains("abc123"));
        assert!(rendered.contains("Opening your default browser…"));
        assert!(rendered.contains("Press Ctrl+C to stop."));
    }

    #[test]
    fn no_open_banner_omits_browser_launch_hint() {
        let banner = ServeBanner {
            root: "/tmp/share".to_string(),
            url: "http://127.0.0.1:9000/".to_string(),
            token: None,
            open_browser: false,
            read_only: false,
            auto_read_only: false,
            state_dir: None,
            public_share: false,
            vite_dev: None,
        };
        let rendered = banner.render();
        assert!(rendered.contains("Open the URL above in your browser."));
        assert!(!rendered.contains("Opening your default browser"));
    }

    #[test]
    fn public_share_banner_uses_network_wording() {
        let banner = ServeBanner {
            root: "/tmp/share".to_string(),
            url: "http://192.168.0.5:8080/?token=abc123".to_string(),
            token: Some("abc123".to_string()),
            open_browser: false,
            read_only: false,
            auto_read_only: false,
            state_dir: None,
            public_share: true,
            vite_dev: None,
        };
        let rendered = banner.render();
        assert!(rendered.contains("Share on your network:"));
    }

    #[test]
    fn dev_frontend_banner_lists_vite_proxy() {
        let banner = ServeBanner {
            root: "/tmp/share".to_string(),
            url: "http://127.0.0.1:9000/".to_string(),
            token: None,
            open_browser: false,
            read_only: false,
            auto_read_only: false,
            state_dir: None,
            public_share: false,
            vite_dev: Some("http://127.0.0.1:5173".to_string()),
        };
        let rendered = banner.render();
        assert!(rendered.contains("Frontend: Vite dev proxy (http://127.0.0.1:5173)"));
    }
}
