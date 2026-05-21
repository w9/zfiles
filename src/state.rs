use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use uuid::Uuid;

pub struct StateStore {
    serve_root: PathBuf,
    db: Mutex<Option<Connection>>,
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
        Self {
            serve_root,
            db: Mutex::new(None),
        }
    }

    pub fn serve_root(&self) -> &Path {
        &self.serve_root
    }

    pub fn dotfolder(&self) -> PathBuf {
        self.serve_root.join(".zfiles")
    }

    pub fn ensure_dotfolder(&self) -> Result<PathBuf> {
        let dot = self.dotfolder();
        std::fs::create_dir_all(&dot).with_context(|| format!("create {}", dot.display()))?;
        std::fs::create_dir_all(dot.join("uploads")).context("create uploads directory")?;
        std::fs::create_dir_all(dot.join("logs")).context("create logs directory")?;
        Ok(dot)
    }

    fn with_db<R>(&self, f: impl FnOnce(&Connection) -> Result<R>) -> Result<R> {
        let mut slot = self
            .db
            .lock()
            .map_err(|_| anyhow::anyhow!("state database mutex poisoned"))?;

        if slot.is_none() {
            let dot = self.ensure_dotfolder()?;
            let db_path = dot.join("state.db");
            let conn = Connection::open(&db_path)
                .with_context(|| format!("open database {}", db_path.display()))?;
            conn.execute_batch(
                "
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS uploads (
                    id TEXT PRIMARY KEY,
                    relative_path TEXT NOT NULL,
                    size INTEGER,
                    offset INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL
                );
                ",
            )?;
            *slot = Some(conn);
        }

        f(slot.as_ref().expect("database initialized"))
    }

    pub fn create_upload(&self, relative_path: String, size: Option<u64>) -> Result<UploadRecord> {
        let id = Uuid::new_v4().to_string();
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |duration| duration.as_secs() as i64);

        self.ensure_dotfolder()?;
        let spool = self.upload_spool_path(&id);
        std::fs::File::create(&spool)
            .with_context(|| format!("create upload spool {}", spool.display()))?;

        self.with_db(|conn| {
            conn.execute(
                "INSERT INTO uploads (id, relative_path, size, offset, created_at) VALUES (?1, ?2, ?3, 0, ?4)",
                params![id, relative_path, size.map(|value| value as i64), created_at],
            )?;
            Ok(())
        })?;

        Ok(UploadRecord {
            id,
            relative_path,
            size,
            offset: 0,
        })
    }

    pub fn get_upload(&self, id: &str) -> Result<Option<UploadRecord>> {
        self.with_db(|conn| {
            let mut stmt =
                conn.prepare("SELECT id, relative_path, size, offset FROM uploads WHERE id = ?1")?;

            let mut rows = stmt.query(params![id])?;
            if let Some(row) = rows.next()? {
                return Ok(Some(UploadRecord {
                    id: row.get(0)?,
                    relative_path: row.get(1)?,
                    size: row.get::<_, Option<i64>>(2)?.map(|value| value as u64),
                    offset: row.get::<_, i64>(3)? as u64,
                }));
            }

            Ok(None)
        })
    }

    pub fn append_upload(&self, id: &str, data: &[u8]) -> Result<UploadRecord> {
        let mut record = self
            .get_upload(id)?
            .ok_or_else(|| anyhow::anyhow!("upload not found"))?;

        if let Some(size) = record.size
            && record.offset + data.len() as u64 > size
        {
            anyhow::bail!("upload exceeds declared length");
        }

        let spool = self.upload_spool_path(id);
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .open(&spool)
            .with_context(|| format!("open upload spool {}", spool.display()))?;
        file.write_all(data)?;

        record.offset += data.len() as u64;

        self.with_db(|conn| {
            conn.execute(
                "UPDATE uploads SET offset = ?1 WHERE id = ?2",
                params![record.offset as i64, id],
            )?;
            Ok(())
        })?;

        Ok(record)
    }

    pub fn finalize_upload(&self, id: &str, fs: &crate::fs::LocalFs) -> Result<PathBuf> {
        let record = self
            .get_upload(id)?
            .ok_or_else(|| anyhow::anyhow!("upload not found"))?;

        if let Some(size) = record.size
            && record.offset != size
        {
            anyhow::bail!("upload incomplete");
        }

        let spool = self.upload_spool_path(id);
        let target = fs.resolve_write(Path::new(&record.relative_path))?;
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create parent directory {}", parent.display()))?;
        }

        std::fs::rename(&spool, &target).with_context(|| {
            format!("move upload {} into {}", spool.display(), target.display())
        })?;

        self.with_db(|conn| {
            conn.execute("DELETE FROM uploads WHERE id = ?1", params![id])?;
            Ok(())
        })?;

        Ok(target)
    }

    pub fn upload_spool_path(&self, id: &str) -> PathBuf {
        self.dotfolder().join("uploads").join(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fs::LocalFs;
    use tempfile::tempdir;

    #[test]
    fn dotfolder_is_created_lazily() {
        let dir = tempdir().unwrap();
        let store = StateStore::new(dir.path().to_path_buf());
        assert!(!store.dotfolder().exists());

        store.ensure_dotfolder().unwrap();
        assert!(store.dotfolder().is_dir());
        assert!(store.dotfolder().join("uploads").is_dir());
    }

    #[test]
    fn upload_round_trip() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let store = StateStore::new(root.clone());
        let fs = LocalFs::new(root);

        let record = store.create_upload("incoming.txt".into(), Some(5)).unwrap();
        assert_eq!(record.offset, 0);
        assert!(store.upload_spool_path(&record.id).exists());

        let updated = store.append_upload(&record.id, b"hello").unwrap();
        assert_eq!(updated.offset, 5);

        let target = store.finalize_upload(&record.id, &fs).unwrap();
        assert_eq!(std::fs::read(target).unwrap(), b"hello");
        assert!(store.get_upload(&record.id).unwrap().is_none());
    }
}
