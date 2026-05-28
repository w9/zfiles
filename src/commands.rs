use anyhow::Context;

use crate::cli::{Cli, Command, ConfigCommand, PluginCommand};
use crate::config::Config;
use crate::plugin::conformance;
use crate::plugins::PluginSupervisor;

pub async fn run(cli: Cli) -> anyhow::Result<()> {
    match cli.command {
        None => crate::transport::serve(cli.serve).await,
        Some(Command::Plugin { command }) => run_plugin(command).await,
        Some(Command::Config { command }) => run_config(command).await,
        Some(Command::Upload {
            server,
            file,
            path,
            token,
            resume,
        }) => run_upload(server, file, path, token, resume).await,
        Some(Command::Init { path }) => run_init(path).await,
        Some(Command::Status { args }) => {
            crate::status_cmd::run(args)?;
            Ok(())
        }
        Some(Command::Daemon { command }) => run_daemon(command),
    }
}

fn run_daemon(command: crate::cli::DaemonCommand) -> anyhow::Result<()> {
    use crate::cli::DaemonCommand;
    use crate::daemon::{DaemonStartArgs, start, status, stop};
    use crate::daemon_config::{start_config, status_config, stop_config};

    match command {
        DaemonCommand::Start {
            path,
            port,
            config,
        } => {
            if let Some(config) = config {
                start_config(config)
            } else {
                start(DaemonStartArgs { path, port })
            }
        }
        DaemonCommand::Stop { path, config } => {
            if let Some(config) = config {
                stop_config(config)
            } else {
                stop(path)
            }
        }
        DaemonCommand::Status { path, config } => {
            if let Some(config) = config {
                status_config(config)
            } else {
                status(path)
            }
        }
    }
}

async fn run_plugin(command: PluginCommand) -> anyhow::Result<()> {
    match command {
        PluginCommand::List => {
            let plugins = PluginSupervisor::new(std::env::current_dir()?).list()?;
            if plugins.is_empty() {
                println!("No plugins discovered.");
                return Ok(());
            }
            for plugin in plugins {
                println!(
                    "{} {} ({})",
                    plugin.manifest.name, plugin.manifest.version, plugin.root.display()
                );
            }
        }
        PluginCommand::Install { source } => {
            let record = PluginSupervisor::new(std::env::current_dir()?).install(&source)?;
            println!(
                "Installed plugin {} to {}",
                record.manifest.name,
                record.root.display()
            );
        }
        PluginCommand::Test { plugin } => {
            let plugin = std::fs::canonicalize(&plugin)
                .with_context(|| format!("resolve plugin path {}", plugin.display()))?;
            conformance::run(&plugin).await?;
            println!("Plugin conformance passed.");
        }
        PluginCommand::Remove { name } => {
            PluginSupervisor::new(std::env::current_dir()?).remove(&name)?;
            println!("Removed plugin {name}");
        }
    }
    Ok(())
}

async fn run_config(command: ConfigCommand) -> anyhow::Result<()> {
    match command {
        ConfigCommand::Get { folder, key } => {
            let config = if let Some(folder) = folder {
                let root = std::fs::canonicalize(&folder)
                    .with_context(|| format!("failed to resolve folder {}", folder.display()))?;
                Config::load(&root)?
            } else {
                Config::load_global()?
            };
            let value = config
                .get(&key)?
                .ok_or_else(|| anyhow::anyhow!("config key {key} is unset"))?;
            println!("{value}");
        }
        ConfigCommand::Set { folder, key, value } => {
            if let Some(folder) = folder {
                let root = std::fs::canonicalize(&folder)
                    .with_context(|| format!("failed to resolve folder {}", folder.display()))?;
                let mut config = Config::load(&root)?;
                config.set(&key, &value)?;
                config.save_to(&Config::folder_config_path(&root))?;
            } else {
                let mut config = Config::load_global()?;
                config.set(&key, &value)?;
                config.save_to(&Config::global_config_path())?;
            }
        }
    }
    Ok(())
}

async fn run_init(path: std::path::PathBuf) -> anyhow::Result<()> {
    let global = Config::init_global()?;
    println!("Initialized {}", global.display());
    let root = std::fs::canonicalize(&path)
        .with_context(|| format!("failed to resolve path {}", path.display()))?;
    let folder = Config::init_folder(&root)?;
    println!("Initialized {}", folder.display());
    Ok(())
}

async fn run_upload(
    server: String,
    file: std::path::PathBuf,
    path: Option<String>,
    token: Option<String>,
    resume: bool,
) -> anyhow::Result<()> {
    let file = std::fs::canonicalize(&file)
        .with_context(|| format!("failed to resolve file {}", file.display()))?;
    let target_path = path.unwrap_or_else(|| {
        file.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("upload.bin")
            .to_string()
    });

    crate::upload::upload_file(crate::upload::UploadOptions {
        server: &server,
        file: &file,
        target_path: &target_path,
        token: token.as_deref(),
        resume,
    })
    .await?;

    println!("Uploaded {target_path} to {server}");
    Ok(())
}
