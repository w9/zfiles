use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};

use crate::config::Config;

#[derive(Debug, Parser)]
#[command(
    name = "zfiles",
    about = "Local file server with browser-based explorer"
)]
pub struct Cli {
    /// Increase logging verbosity (`-v` debug, `-vv` trace). Ignored when `RUST_LOG` is set.
    #[arg(short, long, action = clap::ArgAction::Count, global = true)]
    pub verbose: u8,

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
    /// Create `~/.config/zfiles/` with default configuration
    Init {
        /// Also create per-folder config for this serve root
        #[arg(default_value = ".")]
        path: PathBuf,
    },
    /// Print folder and plugin status
    Status {
        #[command(flatten)]
        args: crate::status_cmd::StatusArgs,
    },
    /// Manage a background server process
    Daemon {
        #[command(subcommand)]
        command: DaemonCommand,
    },
}

#[derive(Debug, Subcommand)]
pub enum DaemonCommand {
    /// Start serving a directory in the background
    Start {
        /// Directory to serve when `--config` is not set
        #[arg(default_value = ".")]
        path: PathBuf,
        /// Port to listen on when `--config` is not set
        #[arg(long)]
        port: Option<u16>,
        /// Multi-folder daemon config with `[[share]]` entries
        #[arg(long)]
        config: Option<PathBuf>,
    },
    /// Stop the background server for a directory
    Stop {
        /// Directory whose daemon should be stopped when `--config` is not set
        #[arg(default_value = ".")]
        path: PathBuf,
        /// Multi-folder daemon config with `[[share]]` entries
        #[arg(long)]
        config: Option<PathBuf>,
    },
    /// Report whether a background server is running
    Status {
        /// Directory whose daemon status should be checked when `--config` is not set
        #[arg(default_value = ".")]
        path: PathBuf,
        /// Multi-folder daemon config with `[[share]]` entries
        #[arg(long)]
        config: Option<PathBuf>,
    },
}

#[derive(Debug, Subcommand)]
pub enum PluginCommand {
    /// List discovered plugins
    List,
    /// Install a plugin directory into `~/.config/zfiles/plugins/`
    Install {
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
        /// Plugin name to remove
        name: String,
    },
}

#[derive(Debug, Subcommand)]
pub enum ConfigCommand {
    /// Read a config value
    Get {
        /// Serve root for per-folder config (omit for global config)
        #[arg(long)]
        folder: Option<PathBuf>,
        /// Dotted config key (e.g. server.read_only)
        key: String,
    },
    /// Write a config value
    Set {
        /// Serve root for per-folder config (omit for global config)
        #[arg(long)]
        folder: Option<PathBuf>,
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

    /// Follow symlinks whose targets lie outside the serve root (read/list only)
    #[arg(long)]
    pub follow_symlinks_outside_root: bool,

    /// Do not open a browser tab on startup
    #[arg(long)]
    pub no_open: bool,

    /// Explorer UI language (`en` or `zh-CN`)
    #[arg(long, value_name = "LOCALE")]
    pub lang: Option<String>,

    /// Proxy UI assets to a Vite dev server for hot module replacement
    #[cfg(feature = "dev-frontend")]
    #[arg(long)]
    pub dev_frontend: bool,

    /// Vite dev server URL (used with `--dev-frontend`)
    #[cfg(feature = "dev-frontend")]
    #[arg(long, default_value = "http://127.0.0.1:5173", requires = "dev_frontend")]
    pub vite_url: String,
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

    pub fn locale(&self) -> Result<Option<&'static str>> {
        match &self.lang {
            Some(value) => Ok(Some(crate::locale::parse_locale(value)?)),
            None => Ok(None),
        }
    }

    #[cfg(feature = "dev-frontend")]
    pub fn vite_dev_enabled(&self) -> bool {
        self.dev_frontend
    }

    #[cfg(feature = "dev-frontend")]
    pub fn vite_dev_url(&self) -> &str {
        &self.vite_url
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

    #[test]
    fn parse_lang_flag() {
        let cli = Cli::parse_from(["zfiles", "--lang", "zh-CN"]);
        assert_eq!(cli.serve.locale().unwrap(), Some("zh-CN"));
    }

    #[test]
    fn reject_unsupported_lang_flag() {
        let cli = Cli::parse_from(["zfiles", "--lang", "fr"]);
        assert!(cli.serve.locale().is_err());
    }

    #[test]
    fn parse_verbose_count() {
        let cli = Cli::parse_from(["zfiles", "-v"]);
        assert_eq!(cli.verbose, 1);

        let cli = Cli::parse_from(["zfiles", "-vv"]);
        assert_eq!(cli.verbose, 2);

        let cli = Cli::parse_from(["zfiles", "--verbose", "--verbose"]);
        assert_eq!(cli.verbose, 2);
    }

    #[test]
    fn parse_follow_symlinks_outside_root_flag() {
        let cli = Cli::parse_from(["zfiles", "--follow-symlinks-outside-root"]);
        assert!(cli.serve.follow_symlinks_outside_root);

        let cli = Cli::parse_from(["zfiles"]);
        assert!(!cli.serve.follow_symlinks_outside_root);
    }

    #[test]
    fn verbose_flag_works_on_subcommands() {
        let cli = Cli::parse_from(["zfiles", "-v", "plugin", "list"]);
        assert_eq!(cli.verbose, 1);
    }

    #[cfg(feature = "dev-frontend")]
    #[test]
    fn parse_dev_frontend_flags() {
        let cli = Cli::parse_from([
            "zfiles",
            "--dev-frontend",
            "--vite-url",
            "http://127.0.0.1:5173",
            "--port",
            "9000",
        ]);
        assert!(cli.serve.vite_dev_enabled());
        assert_eq!(cli.serve.vite_dev_url(), "http://127.0.0.1:5173");
    }
}
