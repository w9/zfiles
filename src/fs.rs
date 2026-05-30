use std::path::{Component, Path, PathBuf};
use std::time::SystemTime;

use anyhow::{Context, Result, bail};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub is_symlink: bool,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<SystemTime>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileStat {
    pub path: String,
    pub is_dir: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub is_symlink: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symlink_target: Option<String>,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<SystemTime>,
}

#[async_trait]
pub trait Fs: Send + Sync {
    async fn read_dir(&self, path: &Path) -> Result<Vec<FileEntry>>;
    async fn stat(&self, path: &Path) -> Result<FileStat>;
}

#[derive(Debug, Clone)]
pub struct LocalFs {
    root: PathBuf,
    follow_symlinks_outside_root: bool,
}

impl LocalFs {
    pub fn new(root: PathBuf) -> Self {
        Self::with_symlink_policy(root, false)
    }

    pub fn with_symlink_policy(root: PathBuf, follow_symlinks_outside_root: bool) -> Self {
        Self {
            root,
            follow_symlinks_outside_root,
        }
    }

    pub fn follow_symlinks_outside_root(&self) -> bool {
        self.follow_symlinks_outside_root
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn resolve_write(&self, path: &Path) -> Result<PathBuf> {
        if path.as_os_str().is_empty() {
            anyhow::bail!("path is required");
        }

        let relative = normalize_relative(path)?;
        let mut accum = PathBuf::new();

        for component in relative.components() {
            accum.push(component);
            let probe = self.root.join(&accum);
            if probe.exists() {
                let canonical = std::fs::canonicalize(&probe)
                    .with_context(|| format!("failed to resolve path {}", probe.display()))?;
                if !canonical.starts_with(&self.root) {
                    anyhow::bail!("path escapes served directory");
                }
            }
        }

        Ok(self.root.join(relative))
    }

    pub fn resolve(&self, path: &Path) -> Result<PathBuf> {
        let relative = if path.as_os_str().is_empty() {
            PathBuf::new()
        } else {
            normalize_relative(path)?
        };

        let joined = self.root.join(&relative);
        let canonical = std::fs::canonicalize(&joined)
            .with_context(|| format!("failed to resolve path {}", joined.display()))?;
        if !self.follow_symlinks_outside_root && !canonical.starts_with(&self.root) {
            bail!("path escapes served directory");
        }
        Ok(canonical)
    }

    pub async fn delete_path(&self, path: &Path) -> Result<()> {
        if path.as_os_str().is_empty() {
            bail!("path is required");
        }

        let relative = normalize_relative(path)?;
        let relative_str = relative.to_string_lossy();
        if relative_str == ".zfiles" || relative_str.starts_with(".zfiles/") {
            bail!("cannot delete server metadata");
        }

        let absolute = self.resolve(path)?;
        let metadata = tokio::fs::metadata(&absolute)
            .await
            .with_context(|| format!("failed to stat path {}", absolute.display()))?;

        if metadata.is_dir() {
            tokio::fs::remove_dir_all(&absolute)
                .await
                .with_context(|| format!("failed to delete directory {}", absolute.display()))?;
        } else {
            tokio::fs::remove_file(&absolute)
                .await
                .with_context(|| format!("failed to delete file {}", absolute.display()))?;
        }

        Ok(())
    }

    fn join_logical_path(parent: &Path, name: &str) -> String {
        if parent.as_os_str().is_empty() {
            name.to_string()
        } else {
            format!("{}/{}", parent.to_string_lossy().replace('\\', "/"), name)
        }
    }
}

#[async_trait]
impl Fs for LocalFs {
    async fn read_dir(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let parent_relative = if path.as_os_str().is_empty() {
            PathBuf::new()
        } else {
            normalize_relative(path)?
        };
        let dir = self.resolve(path)?;
        let mut entries = Vec::new();
        let mut read_dir = tokio::fs::read_dir(&dir)
            .await
            .with_context(|| format!("failed to read directory {}", dir.display()))?;

        while let Some(entry) = read_dir.next_entry().await? {
            let name = entry.file_name().to_string_lossy().into_owned();
            let entry_path = entry.path();
            let file_type = match entry.file_type().await {
                Ok(file_type) => file_type,
                Err(error) => {
                    tracing::debug!(entry = %name, %error, "skipping unreadable directory entry");
                    continue;
                }
            };
            let is_symlink = file_type.is_symlink();
            let metadata = match tokio::fs::metadata(&entry_path).await {
                Ok(metadata) => metadata,
                Err(error) => {
                    tracing::debug!(entry = %name, %error, "skipping unreadable directory entry");
                    continue;
                }
            };
            let relative = Self::join_logical_path(&parent_relative, &name);

            entries.push(FileEntry {
                name,
                path: relative,
                is_dir: metadata.is_dir(),
                is_symlink,
                size: metadata.len(),
                modified: metadata.modified().ok(),
                extra: None,
            });
        }

        entries.sort_by_key(|entry| entry.name.to_lowercase());
        Ok(entries)
    }

    async fn stat(&self, path: &Path) -> Result<FileStat> {
        if path.as_os_str().is_empty() {
            bail!("path is required");
        }
        let relative = normalize_relative(path)?;
        let logical = self.root.join(&relative);
        let link_metadata = tokio::fs::symlink_metadata(&logical)
            .await
            .with_context(|| format!("failed to stat path {}", logical.display()))?;
        let is_symlink = link_metadata.is_symlink();
        let symlink_target = if is_symlink {
            let target = tokio::fs::read_link(&logical)
                .await
                .with_context(|| format!("failed to read symlink {}", logical.display()))?;
            Some(target.to_string_lossy().replace('\\', "/"))
        } else {
            None
        };

        let (is_dir, size, modified) = match tokio::fs::metadata(&logical).await {
            Ok(metadata) => (metadata.is_dir(), metadata.len(), metadata.modified().ok()),
            Err(error) if is_symlink => {
                tracing::debug!(path = %logical.display(), %error, "symlink target unavailable");
                (false, 0, None)
            }
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("failed to stat path {}", logical.display()));
            }
        };

        Ok(FileStat {
            path: relative.to_string_lossy().replace('\\', "/"),
            is_dir,
            is_symlink,
            symlink_target,
            size,
            modified,
        })
    }
}

fn normalize_relative(path: &Path) -> Result<PathBuf> {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => normalized.push(part),
            Component::ParentDir => {
                if !normalized.pop() {
                    bail!("path escapes served directory");
                }
            }
            Component::RootDir | Component::Prefix(_) => {
                bail!("absolute paths are not allowed");
            }
        }
    }

    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn normalize_relative_rejects_parent_escape() {
        let err = normalize_relative(Path::new("../etc/passwd")).unwrap_err();
        assert!(err.to_string().contains("escapes"));
    }

    #[test]
    fn resolve_stays_within_root() {
        let dir = tempdir().unwrap();
        let nested = dir.path().join("nested");
        fs::create_dir(&nested).unwrap();

        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        let resolved = fs.resolve(Path::new("nested")).unwrap();
        assert_eq!(resolved, nested.canonicalize().unwrap());
    }

    #[tokio::test]
    async fn read_dir_lists_entries() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("alpha.txt"), b"hello").unwrap();
        fs::create_dir(dir.path().join("beta")).unwrap();

        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        let entries = fs.read_dir(Path::new("")).await.unwrap();

        assert_eq!(entries.len(), 2);
        assert!(
            entries
                .iter()
                .any(|entry| entry.name == "alpha.txt" && !entry.is_dir)
        );
        assert!(
            entries
                .iter()
                .any(|entry| entry.name == "beta" && entry.is_dir)
        );
    }

    #[tokio::test]
    async fn read_dir_classifies_symlink_to_directory_as_dir() {
        #[cfg(not(unix))]
        {
            return;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let dir = tempdir().unwrap();
            fs::create_dir(dir.path().join("target-dir")).unwrap();
            symlink("target-dir", dir.path().join("linked-dir")).unwrap();

            let fs = LocalFs::new(dir.path().canonicalize().unwrap());
            let entries = fs.read_dir(Path::new("")).await.unwrap();

            let linked = entries
                .iter()
                .find(|entry| entry.name == "linked-dir")
                .expect("symlink entry in listing");
            assert!(linked.is_dir);
            assert!(linked.is_symlink);
        }
    }

    #[tokio::test]
    async fn read_dir_marks_file_symlink() {
        #[cfg(not(unix))]
        {
            return;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let dir = tempdir().unwrap();
            fs::write(dir.path().join("target.txt"), b"hi").unwrap();
            symlink("target.txt", dir.path().join("linked.txt")).unwrap();

            let fs = LocalFs::new(dir.path().canonicalize().unwrap());
            let entries = fs.read_dir(Path::new("")).await.unwrap();

            let linked = entries
                .iter()
                .find(|entry| entry.name == "linked.txt")
                .expect("symlink entry in listing");
            assert!(!linked.is_dir);
            assert!(linked.is_symlink);
        }
    }

    #[tokio::test]
    async fn resolve_rejects_symlink_outside_root_by_default() {
        #[cfg(not(unix))]
        {
            return;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let dir = tempdir().unwrap();
            let outside = tempdir().unwrap();
            symlink(outside.path(), dir.path().join("link-out")).unwrap();

            let fs = LocalFs::new(dir.path().canonicalize().unwrap());
            let err = fs.resolve(Path::new("link-out")).unwrap_err();
            assert!(err.to_string().contains("escapes"));
        }
    }

    #[tokio::test]
    async fn read_dir_follows_symlink_to_directory_outside_root() {
        #[cfg(not(unix))]
        {
            return;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let dir = tempdir().unwrap();
            let outside = tempdir().unwrap();
            fs::write(outside.path().join("inside.txt"), b"hi").unwrap();
            symlink(outside.path(), dir.path().join("link-out")).unwrap();

            let fs = LocalFs::with_symlink_policy(dir.path().canonicalize().unwrap(), true);
            let entries = fs.read_dir(Path::new("link-out")).await.unwrap();

            assert!(
                entries
                    .iter()
                    .any(|entry| entry.name == "inside.txt" && entry.path == "link-out/inside.txt")
            );
        }
    }

    #[tokio::test]
    async fn read_dir_tolerates_macos_photos_library_entries() {
        let pictures = std::path::Path::new("/Users/xunzhu/Pictures");
        if !pictures.is_dir() {
            return;
        }

        let fs = LocalFs::new(pictures.canonicalize().unwrap());
        let entries = fs
            .read_dir(Path::new(""))
            .await
            .expect("list macOS Pictures folder");

        assert!(!entries.is_empty());
        assert!(
            !entries
                .iter()
                .any(|entry| entry.name == "Photos Library.photoslibrary")
        );
    }

    #[tokio::test]
    async fn stat_returns_metadata() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("alpha.txt"), b"hello").unwrap();

        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        let stat = fs.stat(Path::new("alpha.txt")).await.unwrap();

        assert_eq!(stat.path, "alpha.txt");
        assert!(!stat.is_dir);
        assert!(!stat.is_symlink);
        assert_eq!(stat.symlink_target, None);
        assert_eq!(stat.size, 5);
    }

    #[tokio::test]
    async fn stat_returns_symlink_target() {
        #[cfg(not(unix))]
        {
            return;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let dir = tempdir().unwrap();
            fs::write(dir.path().join("target.txt"), b"hello").unwrap();
            symlink("target.txt", dir.path().join("linked.txt")).unwrap();

            let fs = LocalFs::new(dir.path().canonicalize().unwrap());
            let stat = fs.stat(Path::new("linked.txt")).await.unwrap();

            assert_eq!(stat.path, "linked.txt");
            assert!(!stat.is_dir);
            assert!(stat.is_symlink);
            assert_eq!(stat.symlink_target.as_deref(), Some("target.txt"));
            assert_eq!(stat.size, 5);
        }
    }

    #[tokio::test]
    async fn stat_returns_directory_symlink_target() {
        #[cfg(not(unix))]
        {
            return;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let dir = tempdir().unwrap();
            fs::create_dir(dir.path().join("target-dir")).unwrap();
            symlink("target-dir", dir.path().join("linked-dir")).unwrap();

            let fs = LocalFs::new(dir.path().canonicalize().unwrap());
            let stat = fs.stat(Path::new("linked-dir")).await.unwrap();

            assert_eq!(stat.path, "linked-dir");
            assert!(stat.is_dir);
            assert!(stat.is_symlink);
            assert_eq!(stat.symlink_target.as_deref(), Some("target-dir"));
        }
    }

    #[tokio::test]
    async fn delete_path_removes_file() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("alpha.txt"), b"hello").unwrap();

        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        fs.delete_path(Path::new("alpha.txt")).await.unwrap();

        assert!(!dir.path().join("alpha.txt").exists());
    }

    #[tokio::test]
    async fn delete_path_rejects_dotfolder() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".zfiles")).unwrap();

        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        let err = fs.delete_path(Path::new(".zfiles")).await.unwrap_err();
        assert!(err.to_string().contains("metadata"));
    }
}
