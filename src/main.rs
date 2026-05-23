use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = zfiles::cli::Cli::parse();
    zfiles::logging::init_tracing(cli.verbose);
    zfiles::commands::run(cli).await
}
