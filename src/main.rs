use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "zfiles=info,tower_http=info".into()),
        )
        .init();

    let cli = zfiles::cli::Cli::parse();
    zfiles::transport::serve(cli).await
}
