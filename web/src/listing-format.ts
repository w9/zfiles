export function parseModifiedMs(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "object") {
    const record = value as { secs_since_epoch?: number; nanos_since_epoch?: number };
    if (typeof record.secs_since_epoch === "number") {
      return record.secs_since_epoch * 1000 + (record.nanos_since_epoch ?? 0) / 1_000_000;
    }
  }
  return null;
}

export function formatModified(value: unknown, locale: string): string {
  const ms = parseModifiedMs(value);
  if (ms == null) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function listingIconPrefix(isDir: boolean, thumbnailUrl?: string): string {
  if (thumbnailUrl) {
    return "";
  }
  return isDir ? "📁 " : "📄 ";
}

export function formatSize(bytes: number | undefined, isDir: boolean): string {
  if (isDir || bytes == null) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted =
    value >= 100
      ? Math.round(value).toString()
      : Number.isInteger(value)
        ? value.toString()
        : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted} ${units[unitIndex]}`;
}
