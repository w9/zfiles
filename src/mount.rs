use std::io::ErrorKind;
use std::path::Path;

use anyhow::{Context, Result};

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

/// Move a completed upload spool into the served tree (`rename` when possible).
pub fn move_file_into_place(from: &Path, to: &Path) -> Result<()> {
    match std::fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == ErrorKind::CrossesDevices => copy_file_into_place(from, to),
        Err(err) => {
            Err(err).with_context(|| format!("move {} into {}", from.display(), to.display()))
        }
    }
}

fn copy_file_into_place(from: &Path, to: &Path) -> Result<()> {
    std::fs::copy(from, to)
        .with_context(|| format!("copy {} into {}", from.display(), to.display()))?;
    std::fs::File::open(to)
        .and_then(|file| file.sync_all())
        .with_context(|| format!("fsync {}", to.display()))?;
    std::fs::remove_file(from)
        .with_context(|| format!("remove upload spool {}", from.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn move_file_into_place_renames_on_same_filesystem() {
        let dir = tempdir().unwrap();
        let from = dir.path().join("spool.bin");
        let to = dir.path().join("nested").join("file.bin");
        std::fs::create_dir_all(to.parent().unwrap()).unwrap();
        std::fs::write(&from, b"payload").unwrap();

        move_file_into_place(&from, &to).unwrap();

        assert!(!from.exists());
        assert_eq!(std::fs::read(&to).unwrap(), b"payload");
    }
}
