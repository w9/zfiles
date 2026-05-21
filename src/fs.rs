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
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<SystemTime>,
}

#[async_trait]
pub trait Fs: Send + Sync {
    async fn read_dir(&self, path: &Path) -> Result<Vec<FileEntry>>;
}

#[derive(Debug, Clone)]
pub struct LocalFs {
    root: PathBuf,
}

impl LocalFs {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn resolve(&self, path: &Path) -> Result<PathBuf> {
        let relative = if path.as_os_str().is_empty() {
            PathBuf::new()
        } else {
            normalize_relative(path)?
        };

        let joined = self.root.join(relative);
        let canonical = std::fs::canonicalize(&joined)
            .with_context(|| format!("failed to resolve path {}", joined.display()))?;

        if !canonical.starts_with(&self.root) {
            bail!("path escapes served directory");
        }

        Ok(canonical)
    }
}

#[async_trait]
impl Fs for LocalFs {
    async fn read_dir(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let dir = self.resolve(path)?;
        let mut entries = Vec::new();
        let mut read_dir = tokio::fs::read_dir(&dir)
            .await
            .with_context(|| format!("failed to read directory {}", dir.display()))?;

        while let Some(entry) = read_dir.next_entry().await? {
            let file_type = entry.file_type().await?;
            let metadata = entry.metadata().await?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let entry_path = entry.path();
            let relative = entry_path
                .strip_prefix(&self.root)
                .with_context(|| "entry path outside served root")?;

            entries.push(FileEntry {
                name,
                path: relative.to_string_lossy().replace('\\', "/"),
                is_dir: file_type.is_dir(),
                size: metadata.len(),
                modified: metadata.modified().ok(),
            });
        }

        entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(entries)
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
}
