pub fn open_async(url: String) {
    tokio::spawn(async move {
        let result = tokio::process::Command::new("xdg-open")
            .arg(url)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();

        if let Err(error) = result {
            tracing::warn!(%error, "failed to spawn browser");
        }
    });
}
