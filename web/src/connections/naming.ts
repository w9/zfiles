import type { S3ConnectionSettings } from "../cloud/types";

const FALLBACK_NAME = "Connection";

/** Default display name for a new connection, derived from what it points at. */
export function suggestConnectionName(settings: S3ConnectionSettings): string {
  const bucket = settings.bucket.trim();
  if (!bucket) {
    return settings.provider === "r2" ? "Cloudflare R2" : "Amazon S3";
  }
  const prefix = settings.prefix.replace(/^\/+|\/+$/g, "");
  return prefix ? `${bucket}/${prefix}` : bucket;
}

/** Connection names are how URLs and the picker refer to a connection, so they must be unique. */
export function uniqueConnectionName(base: string, taken: Iterable<string>): string {
  const trimmed = base.trim() || FALLBACK_NAME;
  const used = new Set<string>();
  for (const name of taken) {
    used.add(name.trim().toLowerCase());
  }
  if (!used.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  let suffix = 2;
  while (used.has(`${trimmed} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${trimmed} ${suffix}`;
}
