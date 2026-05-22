use anyhow::Result;
use qrcode::QrCode;
use qrcode::render::unicode::Dense1x2;

pub const MIN_DARK_MODULES: usize = 50;

pub fn share_url(host: &str, token: Option<&str>) -> String {
    match token {
        Some(token) => format!("http://{host}/?token={token}"),
        None => format!("http://{host}/"),
    }
}

pub fn render_url(url: &str) -> Result<String> {
    let code = QrCode::new(url.as_bytes())?;
    Ok(code
        .render::<Dense1x2>()
        .dark_color(Dense1x2::Dark)
        .light_color(Dense1x2::Light)
        .build())
}

pub fn print_url(url: &str) -> Result<()> {
    println!("{}", render_url(url)?);
    Ok(())
}

pub fn dark_module_count(image: &str) -> usize {
    image.chars().filter(|&ch| ch == '█').count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_url_contains_qr_modules() {
        let image = render_url("http://192.168.0.5:8080/?token=zfiles-deadbeef").unwrap();
        assert!(
            dark_module_count(&image) >= MIN_DARK_MODULES,
            "expected scannable QR modules, got:\n{image}"
        );
    }

    #[test]
    fn render_url_includes_finder_pattern_rows() {
        let image = render_url("http://example.com").unwrap();
        let rows: Vec<_> = image.lines().filter(|line| line.contains('█')).collect();
        assert!(
            rows.len() >= 5,
            "expected multiple QR rows with dark modules, got:\n{image}"
        );
    }

    #[test]
    fn inverted_dark_color_regression() {
        let code = QrCode::new(b"http://example.com").unwrap();
        let broken = code
            .render::<Dense1x2>()
            .dark_color(Dense1x2::Light)
            .build();
        assert!(
            dark_module_count(&broken) < MIN_DARK_MODULES,
            "inverted colors should not produce a scannable QR"
        );
    }

    #[test]
    fn share_url_includes_token_query() {
        assert_eq!(
            share_url("192.168.0.5:8080", Some("zfiles-abc")),
            "http://192.168.0.5:8080/?token=zfiles-abc"
        );
        assert_eq!(share_url("127.0.0.1:9000", None), "http://127.0.0.1:9000/");
    }
}
