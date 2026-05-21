use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Parser;

#[derive(Debug, Parser)]
#[command(
    name = "zfiles",
    about = "Local file server with browser-based explorer"
)]
pub struct Cli {
    /// Directory to serve
    #[arg(default_value = ".")]
    pub path: PathBuf,

    /// Port to listen on (binds 127.0.0.1)
    #[arg(long, conflicts_with = "listen")]
    pub port: Option<u16>,

    /// Address to listen on (e.g. 127.0.0.1:8080 or 0.0.0.0:8080)
    #[arg(long)]
    pub listen: Option<String>,

    /// Require bearer-token authentication
    #[arg(long)]
    pub token: bool,
}

impl Cli {
    pub fn root_path(&self) -> Result<PathBuf> {
        std::fs::canonicalize(&self.path)
            .with_context(|| format!("failed to resolve serve path {}", self.path.display()))
    }

    pub fn listen_addr(&self) -> Result<SocketAddr> {
        if let Some(listen) = &self.listen {
            return parse_listen(listen);
        }

        if let Some(port) = self.port {
            return Ok(SocketAddr::from(([127, 0, 0, 1], port)));
        }

        Ok(SocketAddr::from(([127, 0, 0, 1], 0)))
    }
}

fn parse_listen(listen: &str) -> Result<SocketAddr> {
    if listen.contains(':') {
        return listen
            .parse()
            .with_context(|| format!("invalid listen address {listen:?}"));
    }

    listen
        .parse::<u16>()
        .map(|port| SocketAddr::from(([127, 0, 0, 1], port)))
        .with_context(|| format!("invalid listen address {listen:?}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_listen_host_port() {
        let addr = parse_listen("127.0.0.1:9000").unwrap();
        assert_eq!(addr, "127.0.0.1:9000".parse().unwrap());
    }

    #[test]
    fn parse_listen_port_only() {
        let addr = parse_listen("9000").unwrap();
        assert_eq!(addr.port(), 9000);
    }

    #[test]
    fn port_and_listen_conflict() {
        let err =
            Cli::try_parse_from(["zfiles", "--port", "8080", "--listen", "9000"]).unwrap_err();
        assert!(err.to_string().contains("cannot be used with"));
    }

    #[test]
    fn default_path_is_current_directory() {
        let cli = Cli::parse_from(["zfiles"]);
        assert_eq!(cli.path, PathBuf::from("."));
    }
}
