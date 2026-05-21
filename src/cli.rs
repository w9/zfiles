use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};

use crate::config::Config;

#[derive(Debug, Parser)]
#[command(
    name = "zfiles",
    about = "Local file server with browser-based explorer",
    args_conflicts_with_subcommands = true
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,

    #[command(flatten)]
    pub serve: ServeArgs,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Manage plugins
    Plugin {
        #[command(subcommand)]
        command: PluginCommand,
    },
    /// Read or write per-folder configuration
    Config {
        #[command(subcommand)]
        command: ConfigCommand,
    },
    /// Upload a file to a remote zfiles server
    Upload {
        /// Base URL of the zfiles server (e.g. http://localhost:8080)
        server: String,
        /// Local file to upload
        file: PathBuf,
        /// Destination path relative to the served directory
        #[arg(long)]
        path: Option<String>,
        /// Bearer token for authenticated servers
        #[arg(long)]
        token: Option<String>,
        /// Resume an in-progress upload when possible
        #[arg(long)]
        resume: bool,
    },
    /// Search filenames under a folder using an installed searcher plugin
    Search {
        #[command(flatten)]
        args: crate::search::SearchArgs,
    },
    /// Create `.zfiles/` with default configuration
    Init {
        /// Directory to initialize
        #[arg(default_value = ".")]
        path: PathBuf,
    },
}

#[derive(Debug, Subcommand)]
pub enum PluginCommand {
    /// List discovered plugins
    List {
        /// Directory whose `.zfiles/plugins` directory should be scanned
        #[arg(default_value = ".")]
        path: PathBuf,
    },
    /// Install a plugin directory into `.zfiles/plugins/`
    Install {
        /// Directory whose `.zfiles/plugins` directory should receive the plugin
        #[arg(default_value = ".")]
        path: PathBuf,
        /// Plugin source directory containing `manifest.toml`
        source: PathBuf,
    },
    /// Run the plugin conformance suite
    Test {
        /// Plugin directory containing `manifest.toml`
        plugin: PathBuf,
    },
    /// Remove an installed plugin
    Remove {
        /// Directory whose `.zfiles/plugins` directory should be modified
        #[arg(default_value = ".")]
        path: PathBuf,
        /// Plugin name to remove
        name: String,
    },
}

#[derive(Debug, Subcommand)]
pub enum ConfigCommand {
    /// Read a config value
    Get {
        /// Directory whose `.zfiles/config.toml` should be read
        #[arg(long, default_value = ".")]
        folder: PathBuf,
        /// Dotted config key (e.g. server.read_only)
        key: String,
    },
    /// Write a config value
    Set {
        /// Directory whose `.zfiles/config.toml` should be written
        #[arg(long, default_value = ".")]
        folder: PathBuf,
        /// Dotted config key (e.g. server.read_only)
        key: String,
        /// Value to store
        value: String,
    },
}

#[derive(Debug, Parser, Clone)]
pub struct ServeArgs {
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

    /// Token lifetime (e.g. 2h, 30m)
    #[arg(long, value_name = "DURATION")]
    pub expire: Option<String>,

    /// Disallow uploads and other mutating operations
    #[arg(long)]
    pub read_only: bool,

    /// Do not open a browser tab on startup
    #[arg(long)]
    pub no_open: bool,
}

impl Cli {
    pub fn is_serve(&self) -> bool {
        self.command.is_none()
    }
}

impl ServeArgs {
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

    pub fn is_public_bind(&self) -> Result<bool> {
        Ok(!self.listen_addr()?.ip().is_loopback())
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
    fn public_bind_requires_token() {
        let cli = Cli::parse_from(["zfiles", "--listen", "0.0.0.0:8080"]);
        assert!(cli.serve.validate().is_err());
    }

    #[test]
    fn default_is_serve_mode() {
        let cli = Cli::parse_from(["zfiles"]);
        assert!(cli.is_serve());
    }
}
