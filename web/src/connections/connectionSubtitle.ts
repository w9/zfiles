import type { ConnectionRecord } from "./types";

/** One-line subtitle for a saved S3/R2 connection: bucket[/prefix] · host. */
export function connectionSubtitle(record: ConnectionRecord): string | null {
  if (record.kind !== "s3") {
    return null;
  }
  const settings = record.settings;
  if (!settings) {
    return null;
  }
  const scope = settings.prefix
    ? `${settings.bucket}/${settings.prefix.replace(/^\/+|\/+$/g, "")}`
    : settings.bucket;
  if (!settings.endpoint) {
    return scope;
  }
  try {
    return `${scope} · ${new URL(settings.endpoint).host}`;
  } catch {
    return `${scope} · ${settings.endpoint}`;
  }
}
