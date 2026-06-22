use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};

use crate::config::Config;

#[derive(Debug, Parser)]
#[command(
    name = "zfiles",
    about = "Local file server with browser-based explorer",
    version
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
    /// Print folder status
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
        /// Address to bind when `--config` is not set
        #[arg(short, long, default_value = "127.0.0.1", value_name = "ADDR")]
        bind: String,
        /// Port to listen on when `--config` is not set (`0` = ephemeral)
        #[arg(short, long, default_value_t = 0, value_name = "PORT")]
        port: u16,
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

const DEFAULT_BIND: &str = "127.0.0.1";

#[derive(Debug, Parser, Clone)]
pub struct ServeArgs {
    /// Directory to serve
    #[arg(default_value = ".")]
    pub path: PathBuf,

    /// Address to bind (e.g. `127.0.0.1` or `0.0.0.0`)
    #[arg(short, long, default_value = DEFAULT_BIND, value_name = "ADDR")]
    pub bind: String,

    /// TCP port to listen on (`0` = ephemeral)
    #[arg(short, long, default_value_t = 0, value_name = "PORT")]
    pub port: u16,

    /// Require bearer-token authentication (default: false)
    #[arg(short, long, default_value_t = false)]
    pub token: bool,

    /// Print a scannable QR code for the share URL in the startup banner
    #[arg(short, long, default_value_t = false, conflicts_with = "no_qr")]
    pub qr: bool,

    /// Do not print a QR code in the startup banner
    #[arg(long, action = clap::ArgAction::SetTrue, conflicts_with = "qr")]
    pub no_qr: bool,

    /// LAN share preset: bind `0.0.0.0`, enable `--token` and `--qr` (overridable)
    #[arg(long, default_value_t = false)]
    pub share: bool,

    /// Token lifetime (e.g. 2h, 30m)
    #[arg(long, value_name = "DURATION")]
    pub expire: Option<String>,

    /// Disallow uploads and other mutating operations (default: false)
    #[arg(short, long, default_value_t = false)]
    pub read_only: bool,

    /// Follow symlinks whose targets lie outside the serve root (read/list only).
    /// Default: true on loopback, false on other hosts. Override with `--no-follow-symlinks-outside-root`.
    #[arg(long, action = clap::ArgAction::SetTrue, default_value_t = false, conflicts_with = "no_follow_symlinks_outside_root")]
    pub follow_symlinks_outside_root: bool,

    /// Reject symlinks whose targets lie outside the serve root even on loopback binds (default: false)
    #[arg(long, action = clap::ArgAction::SetTrue, default_value_t = false, conflicts_with = "follow_symlinks_outside_root")]
    pub no_follow_symlinks_outside_root: bool,

    /// Do not open a browser tab on startup (default: false)
    #[arg(long, default_value_t = false)]
    pub no_open: bool,

    /// Explorer UI language (`en` or `zh-CN`)
    #[arg(long, value_name = "LOCALE")]
    pub lang: Option<String>,

    /// Hostname for the LAN share URL when binding `0.0.0.0` (falls back to `$HOSTNAME`, then external IP)
    #[arg(long, value_name = "HOSTNAME")]
    pub share_host: Option<String>,

    /// Proxy UI assets to a Vite dev server for hot module replacement
    #[cfg(feature = "dev-frontend")]
    #[arg(long, default_value_t = false)]
    pub dev_frontend: bool,

    /// Vite dev server URL (used with `--dev-frontend`)
    #[cfg(feature = "dev-frontend")]
    #[arg(
        long,
        default_value = "http://127.0.0.1:5173",
        requires = "dev_frontend"
    )]
    pub vite_url: String,
}

impl Cli {
    pub fn is_serve(&self) -> bool {
        self.command.is_none()
    }
}

impl ServeArgs {
    pub fn normalize(&mut self) {
        if self.share {
            if self.bind == DEFAULT_BIND {
                self.bind = "0.0.0.0".to_string();
            }
            self.token = true;
            self.qr = true;
        }
        if self.no_qr {
            self.qr = false;
        }
    }

    pub fn root_path(&self) -> Result<PathBuf> {
        std::fs::canonicalize(&self.path)
            .with_context(|| format!("failed to resolve serve path {}", self.path.display()))
    }

    pub fn listen_addr(&self) -> Result<SocketAddr> {
        let ip: IpAddr = self
            .bind
            .parse()
            .with_context(|| format!("invalid bind address {:?}", self.bind))?;
        Ok(SocketAddr::from((ip, self.port)))
    }

    pub fn validate(&self) -> Result<()> {
        let addr = self.listen_addr()?;
        if !addr.ip().is_loopback() && !self.token {
            bail!("binding to a non-loopback address requires --token");
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

    pub fn resolve_follow_symlinks_outside_root(&self) -> Result<bool> {
        if self.follow_symlinks_outside_root {
            return Ok(true);
        }
        if self.no_follow_symlinks_outside_root {
            return Ok(false);
        }
        Ok(self.listen_addr()?.ip().is_loopback())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn listen_addr_from_bind_and_port() {
        let cli = Cli::parse_from(["zfiles", "--bind", "127.0.0.1", "--port", "9000"]);
        assert_eq!(
            cli.serve.listen_addr().unwrap(),
            "127.0.0.1:9000".parse().unwrap()
        );
    }

    #[test]
    fn short_bind_and_port_aliases() {
        let cli = Cli::parse_from(["zfiles", "-b", "127.0.0.1", "-p", "9000"]);
        assert_eq!(
            cli.serve.listen_addr().unwrap(),
            "127.0.0.1:9000".parse().unwrap()
        );
    }

    #[test]
    fn reject_removed_host_flag() {
        use clap::CommandFactory;
        let err = Cli::command()
            .try_get_matches_from(["zfiles", "--host", "127.0.0.1"])
            .unwrap_err();
        assert_eq!(err.kind(), clap::error::ErrorKind::UnknownArgument);
    }

    #[test]
    fn default_listen_addr_is_loopback_ephemeral() {
        let cli = Cli::parse_from(["zfiles"]);
        assert_eq!(
            cli.serve.listen_addr().unwrap(),
            SocketAddr::from(([127, 0, 0, 1], 0))
        );
    }

    #[test]
    fn wildcard_bind_requires_token() {
        let mut serve = Cli::parse_from(["zfiles", "--bind", "0.0.0.0", "--port", "8080"]).serve;
        serve.normalize();
        assert!(serve.validate().is_err());
    }

    #[test]
    fn specific_non_loopback_bind_requires_token() {
        let mut serve =
            Cli::parse_from(["zfiles", "--bind", "192.168.1.50", "--port", "8080"]).serve;
        serve.normalize();
        assert!(serve.validate().is_err());

        let mut serve = Cli::parse_from([
            "zfiles",
            "--bind",
            "192.168.1.50",
            "--port",
            "8080",
            "--token",
        ])
        .serve;
        serve.normalize();
        assert!(serve.validate().is_ok());
    }

    #[test]
    fn loopback_alias_bind_skips_token_requirement() {
        let mut serve = Cli::parse_from(["zfiles", "--bind", "127.0.0.2", "--port", "8080"]).serve;
        serve.normalize();
        assert!(serve.validate().is_ok());
    }

    #[test]
    fn default_is_serve_mode() {
        let cli = Cli::parse_from(["zfiles"]);
        assert!(cli.is_serve());
    }

    #[test]
    fn version_flag_prints_package_version() {
        use clap::CommandFactory;
        let err = Cli::command()
            .try_get_matches_from(["zfiles", "--version"])
            .unwrap_err();
        assert_eq!(err.kind(), clap::error::ErrorKind::DisplayVersion);
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
    fn parse_share_host_flag() {
        let cli = Cli::parse_from([
            "zfiles",
            "--bind",
            "0.0.0.0",
            "--port",
            "8080",
            "--token",
            "--share-host",
            "mybox.local",
        ]);
        assert_eq!(cli.serve.share_host.as_deref(), Some("mybox.local"));
    }

    #[test]
    fn share_preset_sets_bind_token_and_qr() {
        let mut serve = Cli::parse_from(["zfiles", "--share"]).serve;
        serve.normalize();
        assert_eq!(serve.bind, "0.0.0.0");
        assert!(serve.token);
        assert!(serve.qr);
        assert!(serve.validate().is_ok());
    }

    #[test]
    fn share_preset_overridden_by_explicit_bind_and_no_qr() {
        let mut serve =
            Cli::parse_from(["zfiles", "--share", "--bind", "192.168.1.5", "--no-qr"]).serve;
        serve.normalize();
        assert_eq!(serve.bind, "192.168.1.5");
        assert!(serve.token);
        assert!(!serve.qr);
    }

    #[test]
    fn short_aliases_for_token_qr_and_read_only() {
        let cli = Cli::parse_from(["zfiles", "-t", "-q", "-r"]);
        assert!(cli.serve.token);
        assert!(cli.serve.qr);
        assert!(cli.serve.read_only);
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
    fn follow_symlinks_outside_root_defaults_on_loopback() {
        let cli = Cli::parse_from(["zfiles"]);
        assert!(cli.serve.resolve_follow_symlinks_outside_root().unwrap());

        let mut serve =
            Cli::parse_from(["zfiles", "--bind", "0.0.0.0", "--port", "8080", "--token"]).serve;
        serve.normalize();
        assert!(!serve.resolve_follow_symlinks_outside_root().unwrap());
    }

    #[test]
    fn parse_follow_symlinks_outside_root_flags() {
        let cli = Cli::parse_from(["zfiles", "--follow-symlinks-outside-root"]);
        assert!(cli.serve.resolve_follow_symlinks_outside_root().unwrap());

        let cli = Cli::parse_from(["zfiles", "--no-follow-symlinks-outside-root"]);
        assert!(!cli.serve.resolve_follow_symlinks_outside_root().unwrap());

        let mut serve = Cli::parse_from([
            "zfiles",
            "--bind",
            "0.0.0.0",
            "--port",
            "8080",
            "--token",
            "--follow-symlinks-outside-root",
        ])
        .serve;
        serve.normalize();
        assert!(serve.resolve_follow_symlinks_outside_root().unwrap());
    }

    #[test]
    fn verbose_flag_works_on_subcommands() {
        let cli = Cli::parse_from([
            "zfiles",
            "-v",
            "config",
            "get",
            "--folder",
            ".",
            "server.read_only",
        ]);
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
