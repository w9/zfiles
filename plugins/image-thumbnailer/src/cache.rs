use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use rusqlite::{Connection, params};

pub struct Cache {
    db: Option<Connection>,
    cache_dir: PathBuf,
}

impl Cache {
    pub fn disabled() -> Self {
        Self {
            db: None,
            cache_dir: PathBuf::new(),
        }
    }

    pub fn open(storage_path: &Path) -> Result<Self> {
        fs::create_dir_all(storage_path).context("create plugin data directory")?;
        let cache_dir = storage_path.join("cache");
        fs::create_dir_all(&cache_dir).context("create thumbnail cache directory")?;
        let db_path = storage_path.join("index.db");
        let db = Connection::open(&db_path).context("open cache index")?;
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS path_index (
                path TEXT PRIMARY KEY,
                mtime INTEGER NOT NULL,
                content_hash TEXT NOT NULL
            );",
        )
        .context("initialize cache schema")?;
        Ok(Self { db: Some(db), cache_dir })
    }

    pub fn lookup_hash(&self, path: &str, mtime: i64) -> Result<Option<String>> {
        let Some(db) = &self.db else {
            return Ok(None);
        };
        let mut stmt = db.prepare("SELECT content_hash, mtime FROM path_index WHERE path = ?1")?;
        let mut rows = stmt.query(params![path])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };
        let hash: String = row.get(0)?;
        let stored_mtime: i64 = row.get(1)?;
        if stored_mtime == mtime {
            Ok(Some(hash))
        } else {
            Ok(None)
        }
    }

    pub fn store_hash(&self, path: &str, mtime: i64, content_hash: &str) -> Result<()> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        db.execute(
            "INSERT INTO path_index (path, mtime, content_hash) VALUES (?1, ?2, ?3)
             ON CONFLICT(path) DO UPDATE SET mtime = excluded.mtime, content_hash = excluded.content_hash",
            params![path, mtime, content_hash],
        )?;
        Ok(())
    }

    pub fn invalidate_path(&self, path: &str) -> Result<()> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        db.execute("DELETE FROM path_index WHERE path = ?1", params![path])?;
        Ok(())
    }

    pub fn cache_file_path(&self, content_hash: &str, tier: &str) -> PathBuf {
        let prefix = &content_hash[..4];
        let shard_a = &prefix[..2];
        let shard_b = &prefix[2..4];
        self.cache_dir
            .join(shard_a)
            .join(shard_b)
            .join(format!("{content_hash}-{tier}.webp"))
    }

    pub fn read_cached_bytes(&self, content_hash: &str, tier: &str) -> Result<Option<Vec<u8>>> {
        let path = self.cache_file_path(content_hash, tier);
        if !path.is_file() {
            return Ok(None);
        }
        Ok(Some(fs::read(path).context("read cached thumbnail")?))
    }

    pub fn write_cached_bytes(
        &self,
        content_hash: &str,
        tier: &str,
        bytes: &[u8],
    ) -> Result<()> {
        let path = self.cache_file_path(content_hash, tier);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("create cache shard directory")?;
        }
        fs::write(path, bytes).context("write cached thumbnail")?;
        Ok(())
    }
}

pub fn file_mtime(path: &Path) -> Result<i64> {
    let metadata = fs::metadata(path).with_context(|| format!("stat {}", path.display()))?;
    let modified = metadata
        .modified()
        .context("read file modification time")?
        .duration_since(std::time::UNIX_EPOCH)
        .context("mtime before unix epoch")?;
    Ok(modified.as_secs() as i64)
}

pub fn resolve_source(root: &Path, relative: &str) -> Result<PathBuf> {
    let joined = root.join(relative);
    let canonical = joined
        .canonicalize()
        .with_context(|| format!("resolve {}", joined.display()))?;
    let root = root
        .canonicalize()
        .with_context(|| format!("resolve root {}", root.display()))?;
    if !canonical.starts_with(&root) {
        bail!("path escapes serve root");
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn cache_paths_shard_by_hash_prefix() {
        let dir = tempdir().unwrap();
        let cache = Cache::open(dir.path()).unwrap();
        let path = cache.cache_file_path("aabbccddeeff", "grid");
        assert!(path.to_string_lossy().contains("aa/bb/aabbccddeeff-grid.webp"));
    }
}
