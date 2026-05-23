use tracing_subscriber::EnvFilter;

/// Default `EnvFilter` directive string from a `-v` count (`0` = info, `1` = debug, `2+` = trace).
pub fn env_filter_for_verbose(verbose: u8) -> String {
    let level = match verbose {
        0 => "info",
        1 => "debug",
        _ => "trace",
    };
    format!("zfiles={level},tower_http={level}")
}

/// Initialize stderr logging. When `RUST_LOG` is set, it overrides the verbose count.
pub fn init_tracing(verbose: u8) {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| env_filter_for_verbose(verbose).into());

    tracing_subscriber::fmt().with_env_filter(filter).init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_filter_defaults_to_info() {
        assert_eq!(env_filter_for_verbose(0), "zfiles=info,tower_http=info");
    }

    #[test]
    fn env_filter_verbose_is_debug() {
        assert_eq!(env_filter_for_verbose(1), "zfiles=debug,tower_http=debug");
    }

    #[test]
    fn env_filter_double_verbose_is_trace() {
        assert_eq!(env_filter_for_verbose(2), "zfiles=trace,tower_http=trace");
        assert_eq!(env_filter_for_verbose(9), "zfiles=trace,tower_http=trace");
    }
}
