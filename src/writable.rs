use std::path::Path;

/// Returns whether a directory exists (or can be created) and accepts new files.
pub fn is_writable(dir: &Path) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }

    let probe = dir.join(format!(".zfiles-write-probe-{}", std::process::id()));
    match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
    {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn writable_directory_accepts_probe_file() {
        let dir = tempdir().unwrap();
        assert!(is_writable(dir.path()));
    }

    #[test]
    #[cfg(unix)]
    fn read_only_directory_is_not_writable() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let metadata = std::fs::metadata(dir.path()).unwrap();
        let mut permissions = metadata.permissions();
        permissions.set_mode(metadata.permissions().mode() & !0o222);
        std::fs::set_permissions(dir.path(), permissions).unwrap();
        assert!(!is_writable(dir.path()));
    }
}
