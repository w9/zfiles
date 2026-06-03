use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct UploadMeta {
    relative_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<u64>,
}

pub struct StateStore {
    serve_root: PathBuf,
    state_dir: PathBuf,
    lock: Mutex<()>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UploadRecord {
    pub id: String,
    pub relative_path: String,
    pub size: Option<u64>,
    pub offset: u64,
}

impl StateStore {
    pub fn new(serve_root: PathBuf) -> Self {
        let state_dir = crate::dotfolder::resolve_for_root(&serve_root);
        Self::with_state_dir(serve_root, state_dir)
    }

    pub fn with_state_dir(serve_root: PathBuf, state_dir: PathBuf) -> Self {
        Self {
            serve_root,
            state_dir,
            lock: Mutex::new(()),
        }
    }

    pub fn with_dotfolder(serve_root: PathBuf, state_dir: PathBuf) -> Self {
        Self::with_state_dir(serve_root, state_dir)
    }

    pub fn serve_root(&self) -> &Path {
        &self.serve_root
    }

    pub fn state_dir(&self) -> PathBuf {
        self.state_dir.clone()
    }

    pub fn dotfolder(&self) -> PathBuf {
        self.state_dir()
    }

    pub fn ensure_state_dir(&self) -> Result<PathBuf> {
        let dir = self.state_dir();
        std::fs::create_dir_all(&dir).with_context(|| format!("create {}", dir.display()))?;
        std::fs::create_dir_all(dir.join("uploads")).context("create uploads directory")?;
        std::fs::create_dir_all(dir.join("logs")).context("create logs directory")?;
        Ok(dir)
    }

    fn with_lock<R>(&self, f: impl FnOnce() -> Result<R>) -> Result<R> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| anyhow::anyhow!("state store mutex poisoned"))?;
        f()
    }

    pub fn upload_spool_path(&self, id: &str) -> PathBuf {
        self.state_dir().join("uploads").join(id)
    }

    fn upload_meta_path(&self, id: &str) -> PathBuf {
        self.state_dir()
            .join("uploads")
            .join(format!("{id}.meta.json"))
    }

    fn spool_offset(spool: &Path) -> Result<u64> {
        let len = std::fs::metadata(spool)
            .with_context(|| format!("stat upload spool {}", spool.display()))?
            .len();
        Ok(len)
    }

    fn read_meta(path: &Path) -> Result<UploadMeta> {
        let raw = std::fs::read_to_string(path)
            .with_context(|| format!("read upload meta {}", path.display()))?;
        serde_json::from_str(&raw).context("parse upload meta")
    }

    fn write_meta_atomic(path: &Path, meta: &UploadMeta) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create {}", parent.display()))?;
        }
        let tmp = path.with_extension("json.tmp");
        let payload = serde_json::to_vec(meta).context("serialize upload meta")?;
        {
            let mut file = std::fs::File::create(&tmp)
                .with_context(|| format!("create upload meta {}", tmp.display()))?;
            file.write_all(&payload)?;
            file.sync_all()?;
        }
        std::fs::rename(&tmp, path).with_context(|| {
            format!(
                "rename upload meta {} to {}",
                tmp.display(),
                path.display()
            )
        })
    }

    fn load_record(&self, id: &str) -> Result<Option<UploadRecord>> {
        let meta_path = self.upload_meta_path(id);
        let spool = self.upload_spool_path(id);
        if !meta_path.is_file() || !spool.is_file() {
            return Ok(None);
        }

        let meta = Self::read_meta(&meta_path)?;
        let offset = Self::spool_offset(&spool)?;
        Ok(Some(UploadRecord {
            id: id.to_string(),
            relative_path: meta.relative_path,
            size: meta.size,
            offset,
        }))
    }

    pub fn create_upload(&self, relative_path: String, size: Option<u64>) -> Result<UploadRecord> {
        self.with_lock(|| {
            let id = Uuid::new_v4().to_string();
            self.ensure_state_dir()?;

            let spool = self.upload_spool_path(&id);
            std::fs::File::create(&spool)
                .with_context(|| format!("create upload spool {}", spool.display()))?;

            let meta = UploadMeta {
                relative_path: relative_path.clone(),
                size,
            };
            Self::write_meta_atomic(&self.upload_meta_path(&id), &meta)?;

            Ok(UploadRecord {
                id,
                relative_path,
                size,
                offset: 0,
            })
        })
    }

    pub fn get_upload(&self, id: &str) -> Result<Option<UploadRecord>> {
        self.with_lock(|| self.load_record(id))
    }

    pub fn append_upload(&self, id: &str, data: &[u8]) -> Result<UploadRecord> {
        self.with_lock(|| {
            let record = self
                .load_record(id)?
                .ok_or_else(|| anyhow::anyhow!("upload not found"))?;

            if let Some(size) = record.size
                && record.offset + data.len() as u64 > size
            {
                anyhow::bail!("upload exceeds declared length");
            }

            let spool = self.upload_spool_path(id);
            let mut file = std::fs::OpenOptions::new()
                .append(true)
                .open(&spool)
                .with_context(|| format!("open upload spool {}", spool.display()))?;
            file.write_all(data)?;

            let offset = Self::spool_offset(&spool)?;
            Ok(UploadRecord {
                offset,
                ..record
            })
        })
    }

    pub fn finalize_upload(&self, id: &str, fs: &crate::fs::LocalFs) -> Result<PathBuf> {
        self.with_lock(|| {
            let record = self
                .load_record(id)?
                .ok_or_else(|| anyhow::anyhow!("upload not found"))?;

            if let Some(size) = record.size
                && record.offset != size
            {
                anyhow::bail!("upload incomplete");
            }

            let spool = self.upload_spool_path(id);
            let meta_path = self.upload_meta_path(id);
            let target = fs.resolve_write(Path::new(&record.relative_path))?;
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).with_context(|| {
                    format!("create parent directory {}", parent.display())
                })?;
            }

            crate::mount::warn_if_cross_mount(
                "upload finalize",
                &spool,
                target.parent().unwrap_or(&target),
            );

            {
                let file = std::fs::OpenOptions::new()
                    .append(true)
                    .open(&spool)
                    .with_context(|| format!("open upload spool {}", spool.display()))?;
                file.sync_all()
                    .with_context(|| format!("fsync upload spool {}", spool.display()))?;
            }

            std::fs::rename(&spool, &target).with_context(|| {
                format!("move upload {} into {}", spool.display(), target.display())
            })?;
            let _ = std::fs::remove_file(&meta_path);

            Ok(target)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fs::LocalFs;
    use crate::xdg;
    use serde_json::Value;
    use tempfile::tempdir;

    fn upload_meta_path(store: &StateStore, id: &str) -> PathBuf {
        store.upload_meta_path(id)
    }

    fn store_with_local_state(share_name: &str) -> (tempfile::TempDir, StateStore) {
        let dir = tempdir().unwrap();
        let serve_root = dir.path().join(share_name);
        std::fs::create_dir_all(&serve_root).unwrap();
        let serve_root = serve_root.canonicalize().unwrap();
        let state_dir = dir.path().join(".state");
        (
            dir,
            StateStore::with_state_dir(serve_root, state_dir),
        )
    }

    fn read_meta(store: &StateStore, id: &str) -> Value {
        let raw = std::fs::read_to_string(upload_meta_path(store, id)).unwrap();
        serde_json::from_str(&raw).unwrap()
    }

    #[test]
    fn state_dir_is_created_lazily() {
        let dir = tempdir().unwrap();
        xdg::with_test_homes(dir.path().to_path_buf(), || {
            let root = dir.path().canonicalize().unwrap();
            let store = StateStore::new(root);
            assert!(!store.state_dir().exists());

            store.ensure_state_dir().unwrap();
            assert!(store.state_dir().is_dir());
            assert!(store.state_dir().join("uploads").is_dir());
        });
    }

    #[test]
    fn upload_round_trip() {
        let dir = tempdir().unwrap();
        xdg::with_test_homes(dir.path().to_path_buf(), || {
            let root = dir.path().canonicalize().unwrap();
            let store = StateStore::new(root.clone());
            let fs = LocalFs::new(root.clone());

            let record = store.create_upload("incoming.txt".into(), Some(5)).unwrap();
            assert_eq!(record.offset, 0);
            assert!(store.upload_spool_path(&record.id).exists());
            assert!(store.state_dir().starts_with(xdg::config_home()));

            let updated = store.append_upload(&record.id, b"hello").unwrap();
            assert_eq!(updated.offset, 5);

            let target = store.finalize_upload(&record.id, &fs).unwrap();
            assert_eq!(std::fs::read(target).unwrap(), b"hello");
            assert!(store.get_upload(&record.id).unwrap().is_none());
        });
    }

    #[test]
    fn create_upload_writes_meta_and_empty_spool() {
        let (_dir, store) = store_with_local_state("share");

        let record = store.create_upload("file.txt".into(), Some(10)).unwrap();
        let spool = store.upload_spool_path(&record.id);
        let meta = upload_meta_path(&store, &record.id);

        assert!(spool.is_file());
        assert_eq!(std::fs::metadata(&spool).unwrap().len(), 0);
        assert!(meta.is_file());
        assert!(!store.state_dir().join("state.db").exists());

        let meta = read_meta(&store, &record.id);
        assert_eq!(meta["relative_path"], "file.txt");
        assert_eq!(meta["size"], 10);
    }

    #[test]
    fn offset_comes_from_spool_size() {
        let (_dir, store) = store_with_local_state("share");
        let record = store.create_upload("file.txt".into(), Some(10)).unwrap();

        store.append_upload(&record.id, b"ab").unwrap();
        let loaded = store.get_upload(&record.id).unwrap().unwrap();
        assert_eq!(loaded.offset, 2);
        assert_eq!(
            std::fs::metadata(store.upload_spool_path(&record.id))
                .unwrap()
                .len(),
            2
        );

        store.append_upload(&record.id, b"cde").unwrap();
        let loaded = store.get_upload(&record.id).unwrap().unwrap();
        assert_eq!(loaded.offset, 5);
    }

    #[test]
    fn multi_chunk_append_then_finalize() {
        let (_dir, store) = store_with_local_state("share");
        let fs = LocalFs::new(store.serve_root().to_path_buf());
        let record = store.create_upload("chunks.bin".into(), Some(6)).unwrap();

        store.append_upload(&record.id, b"ab").unwrap();
        store.append_upload(&record.id, b"cd").unwrap();
        store.append_upload(&record.id, b"ef").unwrap();

        let target = store.finalize_upload(&record.id, &fs).unwrap();
        assert_eq!(std::fs::read(target).unwrap(), b"abcdef");
    }

    #[test]
    fn survives_store_reopen() {
        let (_dir, store) = store_with_local_state("share");
        let root = store.serve_root().to_path_buf();
        let state_dir = store.state_dir();
        let record = store.create_upload("resume.txt".into(), Some(6)).unwrap();
        store.append_upload(&record.id, b"abc").unwrap();
        let id = record.id.clone();

        let store = StateStore::with_state_dir(root.clone(), state_dir);
        let fs = LocalFs::new(root);
        let loaded = store.get_upload(&id).unwrap().unwrap();
        assert_eq!(loaded.offset, 3);

        store.append_upload(&id, b"def").unwrap();
        let target = store.finalize_upload(&id, &fs).unwrap();
        assert_eq!(std::fs::read_to_string(target).unwrap(), "abcdef");
    }

    #[test]
    fn finalize_cleans_artifacts() {
        let (_dir, store) = store_with_local_state("share");
        let fs = LocalFs::new(store.serve_root().to_path_buf());
        let record = store.create_upload("done.txt".into(), Some(3)).unwrap();
        let id = record.id.clone();
        let spool = store.upload_spool_path(&id);
        let meta = upload_meta_path(&store, &id);

        store.append_upload(&id, b"yes").unwrap();
        store.finalize_upload(&id, &fs).unwrap();

        assert!(!spool.exists());
        assert!(!meta.exists());
        assert!(store.get_upload(&id).unwrap().is_none());
    }

    #[test]
    fn append_exceeds_upload_length_fails() {
        let (_dir, store) = store_with_local_state("share");
        let record = store.create_upload("file.txt".into(), Some(3)).unwrap();
        store.append_upload(&record.id, b"ab").unwrap();

        let err = store.append_upload(&record.id, b"cde").unwrap_err();
        assert!(err.to_string().contains("exceeds declared length"));

        let loaded = store.get_upload(&record.id).unwrap().unwrap();
        assert_eq!(loaded.offset, 2);
    }

    #[test]
    fn finalize_incomplete_fails() {
        let (_dir, store) = store_with_local_state("share");
        let fs = LocalFs::new(store.serve_root().to_path_buf());
        let record = store.create_upload("file.txt".into(), Some(5)).unwrap();
        store.append_upload(&record.id, b"ab").unwrap();

        let err = store.finalize_upload(&record.id, &fs).unwrap_err();
        assert!(err.to_string().contains("incomplete"));
        assert!(store.get_upload(&record.id).unwrap().is_some());
        assert!(upload_meta_path(&store, &record.id).exists());
        assert!(store.upload_spool_path(&record.id).exists());
    }

    #[test]
    fn orphan_meta_without_spool_returns_none() {
        let (_dir, store) = store_with_local_state("share");
        store.ensure_state_dir().unwrap();
        let id = "00000000-0000-4000-8000-000000000001";
        let meta = upload_meta_path(&store, id);
        std::fs::write(
            &meta,
            r#"{"relative_path":"x.txt","size":1}"#,
        )
        .unwrap();

        assert!(store.get_upload(id).unwrap().is_none());
    }

    #[test]
    fn orphan_spool_without_meta_returns_none() {
        let (_dir, store) = store_with_local_state("share");
        store.ensure_state_dir().unwrap();
        let id = "00000000-0000-4000-8000-000000000002";
        std::fs::write(store.upload_spool_path(id), b"x").unwrap();

        assert!(store.get_upload(id).unwrap().is_none());
    }

    #[test]
    fn nested_relative_path_round_trips() {
        let (_dir, store) = store_with_local_state("share");
        let fs = LocalFs::new(store.serve_root().to_path_buf());
        let record = store
            .create_upload("nested/dir/file.txt".into(), Some(2))
            .unwrap();

        let meta = read_meta(&store, &record.id);
        assert_eq!(meta["relative_path"], "nested/dir/file.txt");

        store.append_upload(&record.id, b"ok").unwrap();
        let target = store.finalize_upload(&record.id, &fs).unwrap();
        assert_eq!(
            target,
            store.serve_root().join("nested/dir/file.txt")
        );
        assert_eq!(std::fs::read_to_string(target).unwrap(), "ok");
    }

    #[test]
    fn two_uploads_do_not_interfere() {
        let (_dir, store) = store_with_local_state("share");
        let fs = LocalFs::new(store.serve_root().to_path_buf());

        let a = store.create_upload("a.txt".into(), Some(1)).unwrap();
        let b = store.create_upload("b.txt".into(), Some(2)).unwrap();

        store.append_upload(&a.id, b"a").unwrap();
        store.append_upload(&b.id, b"bb").unwrap();

        store.finalize_upload(&a.id, &fs).unwrap();
        store.finalize_upload(&b.id, &fs).unwrap();

        assert_eq!(
            std::fs::read_to_string(store.serve_root().join("a.txt")).unwrap(),
            "a"
        );
        assert_eq!(
            std::fs::read_to_string(store.serve_root().join("b.txt")).unwrap(),
            "bb"
        );
        assert!(store.get_upload(&a.id).unwrap().is_none());
        assert!(store.get_upload(&b.id).unwrap().is_none());
    }

}
