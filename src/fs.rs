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

    pub async fn create_dir(&self, parent: &Path, name: &str) -> Result<String> {
        validate_entry_name(name)?;
        let parent_relative = if parent.as_os_str().is_empty() {
            PathBuf::new()
        } else {
            normalize_relative(parent)?
        };
        let relative = if parent_relative.as_os_str().is_empty() {
            PathBuf::from(name)
        } else {
            parent_relative.join(name)
        };
        let relative_str = relative.to_string_lossy();
        guard_server_metadata_relative(&relative_str)?;

        let absolute = self.resolve_write(&relative)?;
        if absolute.exists() {
            bail!("path already exists");
        }
        tokio::fs::create_dir(&absolute)
            .await
            .with_context(|| format!("failed to create directory {}", absolute.display()))?;
        Ok(relative_str.replace('\\', "/"))
    }

    pub async fn rename_path(
        &self,
        path: &Path,
        new_name: &str,
        overwrite: bool,
    ) -> Result<String> {
        if path.as_os_str().is_empty() {
            bail!("path is required");
        }
        validate_entry_name(new_name)?;
        let relative = normalize_relative(path)?;
        let relative_str = relative.to_string_lossy();
        guard_server_metadata_relative(&relative_str)?;

        let parent = relative
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_default();
        let dest_relative = if parent.as_os_str().is_empty() {
            PathBuf::from(new_name)
        } else {
            parent.join(new_name)
        };
        let dest_str = dest_relative.to_string_lossy().replace('\\', "/");
        guard_server_metadata_relative(&dest_str)?;

        if dest_str == relative_str {
            return Ok(dest_str);
        }

        let from = self.resolve(path)?;
        let to = self.resolve_write(&dest_relative)?;
        if to.exists() {
            if !overwrite {
                bail!("path already exists");
            }
            ensure_same_entry_kind(&from, &to).await?;
            remove_path_tree(&to).await?;
        }
        if let Some(parent_abs) = to.parent()
            && !parent_abs.exists()
        {
            bail!("parent directory does not exist");
        }
        tokio::fs::rename(&from, &to)
            .await
            .with_context(|| format!("failed to rename {} to {}", from.display(), to.display()))?;
        Ok(dest_str)
    }

    pub async fn copy_into_dir(
        &self,
        source: &Path,
        dest_dir: &Path,
        dest_name: Option<&str>,
        overwrite: bool,
    ) -> Result<String> {
        let (dest_abs, dest_logical) = self
            .prepare_copy_or_move_dest(source, dest_dir, dest_name, overwrite)
            .await?;
        let from = self.resolve(source)?;
        copy_path_tree(&from, &dest_abs).await?;
        Ok(dest_logical)
    }

    pub async fn move_into_dir(
        &self,
        source: &Path,
        dest_dir: &Path,
        dest_name: Option<&str>,
        overwrite: bool,
    ) -> Result<String> {
        if source.as_os_str().is_empty() {
            bail!("path is required");
        }
        let source_relative = normalize_relative(source)?;
        let source_str = source_relative.to_string_lossy();
        guard_server_metadata_relative(&source_str)?;

        let parent_relative = if dest_dir.as_os_str().is_empty() {
            PathBuf::new()
        } else {
            normalize_relative(dest_dir)?
        };
        let dest_dir_str = parent_relative.to_string_lossy();
        if is_logical_descendant(&dest_dir_str, &source_str) {
            bail!("cannot move into itself or a descendant");
        }

        let name = dest_name
            .map(str::to_string)
            .or_else(|| {
                source_relative
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
            })
            .ok_or_else(|| anyhow::anyhow!("invalid source path"))?;
        validate_entry_name(&name)?;

        let dest_relative = if parent_relative.as_os_str().is_empty() {
            PathBuf::from(&name)
        } else {
            parent_relative.join(&name)
        };
        let dest_str = dest_relative.to_string_lossy().replace('\\', "/");
        guard_server_metadata_relative(&dest_str)?;

        let from = self.resolve(source)?;
        let to = self.resolve_write(&dest_relative)?;

        if from == to {
            return Ok(dest_str);
        }

        if to.exists() {
            if !overwrite {
                bail!("path already exists");
            }
            ensure_same_entry_kind(&from, &to).await?;
            remove_path_tree(&to).await?;
        }

        if from.parent() == to.parent() {
            tokio::fs::rename(&from, &to).await.with_context(|| {
                format!("failed to rename {} to {}", from.display(), to.display())
            })?;
            return Ok(dest_str);
        }

        copy_path_tree(&from, &to).await?;
        remove_path_tree(&from).await?;
        Ok(dest_str)
    }

    async fn prepare_copy_or_move_dest(
        &self,
        source: &Path,
        dest_dir: &Path,
        dest_name: Option<&str>,
        overwrite: bool,
    ) -> Result<(PathBuf, String)> {
        if source.as_os_str().is_empty() {
            bail!("path is required");
        }
        let source_relative = normalize_relative(source)?;
        let source_str = source_relative.to_string_lossy();
        guard_server_metadata_relative(&source_str)?;

        let parent_relative = if dest_dir.as_os_str().is_empty() {
            PathBuf::new()
        } else {
            normalize_relative(dest_dir)?
        };
        let dest_dir_str = parent_relative.to_string_lossy();
        if is_logical_descendant(&dest_dir_str, &source_str) {
            bail!("cannot copy into itself or a descendant");
        }

        let name = dest_name
            .map(str::to_string)
            .or_else(|| {
                source_relative
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
            })
            .ok_or_else(|| anyhow::anyhow!("invalid source path"))?;
        validate_entry_name(&name)?;

        let dest_relative = if parent_relative.as_os_str().is_empty() {
            PathBuf::from(&name)
        } else {
            parent_relative.join(&name)
        };
        let dest_str = dest_relative.to_string_lossy().replace('\\', "/");
        guard_server_metadata_relative(&dest_str)?;

        let from = self.resolve(source)?;
        let to = self.resolve_write(&dest_relative)?;

        if from == to {
            return Ok((to, dest_str));
        }

        if to.exists() {
            if !overwrite {
                bail!("path already exists");
            }
            ensure_same_entry_kind(&from, &to).await?;
            remove_path_tree(&to).await?;
        }

        Ok((to, dest_str))
    }

    pub async fn delete_path(&self, path: &Path) -> Result<()> {
        if path.as_os_str().is_empty() {
            bail!("path is required");
        }

        let relative = normalize_relative(path)?;
        let relative_str = relative.to_string_lossy();
        guard_server_metadata_relative(&relative_str)?;

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

fn guard_server_metadata_relative(relative: &str) -> Result<()> {
    if relative == ".zfiles" || relative.starts_with(".zfiles/") {
        bail!("cannot modify server metadata");
    }
    Ok(())
}

fn validate_entry_name(name: &str) -> Result<()> {
    if name.is_empty() || name == "." || name == ".." {
        bail!("invalid name");
    }
    if name.contains('/') || name.contains('\\') {
        bail!("name must not contain path separators");
    }
    Ok(())
}

fn is_logical_descendant(child: &str, ancestor: &str) -> bool {
    if ancestor.is_empty() {
        return false;
    }
    child == ancestor || child.starts_with(&format!("{ancestor}/"))
}

async fn ensure_same_entry_kind(from: &Path, to: &Path) -> Result<()> {
    let from_meta = tokio::fs::symlink_metadata(from)
        .await
        .with_context(|| format!("failed to stat {}", from.display()))?;
    let to_meta = tokio::fs::symlink_metadata(to)
        .await
        .with_context(|| format!("failed to stat {}", to.display()))?;
    let from_dir = from_meta.is_dir();
    let to_dir = to_meta.is_dir();
    if from_dir != to_dir {
        bail!("cannot replace a file with a folder or vice versa");
    }
    Ok(())
}

async fn remove_path_tree(path: &Path) -> Result<()> {
    let meta = tokio::fs::symlink_metadata(path)
        .await
        .with_context(|| format!("failed to stat {}", path.display()))?;
    if meta.is_dir() {
        tokio::fs::remove_dir_all(path)
            .await
            .with_context(|| format!("failed to remove directory {}", path.display()))?;
    } else {
        tokio::fs::remove_file(path)
            .await
            .with_context(|| format!("failed to remove file {}", path.display()))?;
    }
    Ok(())
}

async fn copy_path_tree(from: &Path, to: &Path) -> Result<()> {
    let meta = tokio::fs::symlink_metadata(from)
        .await
        .with_context(|| format!("failed to stat {}", from.display()))?;
    if meta.is_dir() {
        tokio::fs::create_dir_all(to)
            .await
            .with_context(|| format!("failed to create directory {}", to.display()))?;
        let mut read_dir = tokio::fs::read_dir(from)
            .await
            .with_context(|| format!("failed to read directory {}", from.display()))?;
        while let Some(entry) = read_dir.next_entry().await? {
            let name = entry.file_name();
            Box::pin(copy_path_tree(&entry.path(), &to.join(name))).await?;
        }
    } else {
        if let Some(parent) = to.parent() {
            tokio::fs::create_dir_all(parent).await.with_context(|| {
                format!("failed to create parent directory {}", parent.display())
            })?;
        }
        tokio::fs::copy(from, to)
            .await
            .with_context(|| format!("failed to copy {} to {}", from.display(), to.display()))?;
    }
    Ok(())
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
    async fn create_dir_and_rename() {
        let dir = tempdir().unwrap();
        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        let created = fs.create_dir(Path::new(""), "projects").await.unwrap();
        assert_eq!(created, "projects");
        let renamed = fs
            .rename_path(Path::new("projects"), "work", false)
            .await
            .unwrap();
        assert_eq!(renamed, "work");
        assert!(dir.path().join("work").is_dir());
    }

    #[tokio::test]
    async fn copy_and_move_file() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"hello").unwrap();
        fs::write(dir.path().join("b.txt"), b"world").unwrap();
        let fs = LocalFs::new(dir.path().canonicalize().unwrap());
        fs::create_dir(dir.path().join("dest")).unwrap();

        let copied = fs
            .copy_into_dir(Path::new("a.txt"), Path::new("dest"), None, false)
            .await
            .unwrap();
        assert_eq!(copied, "dest/a.txt");
        assert!(dir.path().join("dest/a.txt").exists());

        let moved = fs
            .move_into_dir(Path::new("b.txt"), Path::new("dest"), None, false)
            .await
            .unwrap();
        assert_eq!(moved, "dest/b.txt");
        assert!(!dir.path().join("b.txt").exists());
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
