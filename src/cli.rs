use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use clap::Parser;

use crate::config::Config;

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

    /// Disallow uploads and other mutating operations
    #[arg(long)]
    pub read_only: bool,

    /// Do not open a browser tab on startup
    #[arg(long)]
    pub no_open: bool,
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

    pub fn validate(&self) -> Result<()> {
        let addr = self.listen_addr()?;
        if addr.ip().is_unspecified() && !self.token {
            bail!("binding to all interfaces requires --token");
        }
        Ok(())
    }

    pub fn read_only(&self, config: &Config) -> bool {
        self.read_only || config.read_only()
    }

    pub fn should_open_browser(&self, config: &Config) -> bool {
        !self.no_open && config.open_browser()
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

    #[test]
    fn public_bind_requires_token() {
        let cli = Cli::parse_from(["zfiles", "--listen", "0.0.0.0:8080"]);
        assert!(cli.validate().is_err());
    }

    #[test]
    fn public_bind_allows_token() {
        let cli = Cli::parse_from(["zfiles", "--listen", "0.0.0.0:8080", "--token"]);
        assert!(cli.validate().is_ok());
    }

    #[test]
    fn localhost_bind_without_token_is_allowed() {
        let cli = Cli::parse_from(["zfiles", "--listen", "127.0.0.1:8080"]);
        assert!(cli.validate().is_ok());
    }
}
