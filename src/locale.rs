use anyhow::{Result, bail};

pub const SUPPORTED_LOCALES: &[&str] = &["en", "zh-CN"];

pub fn parse_locale(value: &str) -> Result<&'static str> {
    match value {
        "en" => Ok("en"),
        "zh-CN" | "zh" => Ok("zh-CN"),
        other => bail!("unsupported locale {other:?}; supported: en, zh-CN"),
    }
}

pub fn explorer_url(host: &str, token: Option<&str>, lang: Option<&str>) -> String {
    let mut params = Vec::new();
    if let Some(token) = token {
        params.push(format!("token={token}"));
    }
    if let Some(lang) = lang {
        params.push(format!("lang={lang}"));
    }
    if params.is_empty() {
        format!("http://{host}/")
    } else {
        format!("http://{host}/?{}", params.join("&"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_locale_accepts_supported_values() {
        assert_eq!(parse_locale("en").unwrap(), "en");
        assert_eq!(parse_locale("zh-CN").unwrap(), "zh-CN");
        assert_eq!(parse_locale("zh").unwrap(), "zh-CN");
    }

    #[test]
    fn parse_locale_rejects_unknown_values() {
        assert!(parse_locale("fr").is_err());
    }

    #[test]
    fn explorer_url_includes_token_and_lang_query() {
        assert_eq!(
            explorer_url(
                "127.0.0.1:9000",
                Some("a1b2c3d4e5f6789012345678abcdef01"),
                Some("zh-CN"),
            ),
            "http://127.0.0.1:9000/?token=a1b2c3d4e5f6789012345678abcdef01&lang=zh-CN"
        );
        assert_eq!(
            explorer_url("127.0.0.1:9000", None, Some("en")),
            "http://127.0.0.1:9000/?lang=en"
        );
        assert_eq!(
            explorer_url("127.0.0.1:9000", None, None),
            "http://127.0.0.1:9000/"
        );
    }
}
