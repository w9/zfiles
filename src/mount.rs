use std::path::Path;

use anyhow::Result;

#[cfg(unix)]
pub fn same_filesystem(left: &Path, right: &Path) -> Result<bool> {
    use std::os::unix::fs::MetadataExt;

    let left = std::fs::metadata(left)?;
    let right = std::fs::metadata(right)?;
    Ok(left.dev() == right.dev())
}

#[cfg(not(unix))]
pub fn same_filesystem(_left: &Path, _right: &Path) -> Result<bool> {
    Ok(true)
}

pub fn warn_if_cross_mount(label: &str, left: &Path, right: &Path) {
    if !left.exists() || !right.exists() {
        return;
    }

    match same_filesystem(left, right) {
        Ok(true) => {}
        Ok(false) => eprintln!(
            "warning: {label} spans filesystems ({} vs {}); atomic rename may fail",
            left.display(),
            right.display()
        ),
        Err(error) => eprintln!("warning: could not compare filesystems for {label}: {error}"),
    }
}
