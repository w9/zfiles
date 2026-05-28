/** Trim leading/trailing slashes from an explorer-relative path segment. */
export function normalizeExplorerPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

/** Normalize bucket prefix (may be empty). Always uses forward slashes, no leading slash. */
export function normalizeBucketPrefix(prefix: string): string {
  const trimmed = prefix.replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

/** S3 list prefix for an explorer directory path. */
export function listPrefixForPath(bucketPrefix: string, explorerPath: string): string {
  const base = normalizeBucketPrefix(bucketPrefix);
  const rel = normalizeExplorerPath(explorerPath);
  if (!base && !rel) {
    return "";
  }
  if (!rel) {
    return base;
  }
  return `${base}${rel}/`;
}

/** Full object key for a file at an explorer path. */
export function objectKeyForPath(
  bucketPrefix: string,
  explorerPath: string,
  name: string,
): string {
  const base = normalizeBucketPrefix(bucketPrefix);
  const rel = normalizeExplorerPath(explorerPath);
  const parts = [base.replace(/\/$/, ""), rel, name].filter(Boolean);
  return parts.join("/");
}

/** Explorer-relative path for a child directory from a ListObjectsV2 CommonPrefix. */
export function explorerPathFromCommonPrefix(
  bucketPrefix: string,
  commonPrefix: string,
): { name: string; path: string } | null {
  const base = normalizeBucketPrefix(bucketPrefix);
  if (!commonPrefix.startsWith(base)) {
    return null;
  }
  const remainder = commonPrefix.slice(base.length).replace(/\/$/, "");
  if (!remainder) {
    return null;
  }
  const name = remainder.split("/").pop() ?? remainder;
  return { name, path: remainder };
}

/** Explorer-relative path for a file object key. */
export function explorerPathFromObjectKey(
  bucketPrefix: string,
  key: string,
): { name: string; path: string } | null {
  const base = normalizeBucketPrefix(bucketPrefix);
  if (base && !key.startsWith(base)) {
    return null;
  }
  const rel = base ? key.slice(base.length) : key;
  if (!rel || rel.endsWith("/")) {
    return null;
  }
  const name = rel.split("/").pop() ?? rel;
  return { name, path: rel };
}
