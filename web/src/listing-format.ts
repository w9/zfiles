import type { ModifiedTimeFormat } from "@/settings/modifiedTimeFormat";

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

const RELATIVE_TIME_UNITS: Array<{
  unit: Intl.RelativeTimeFormatUnit;
  seconds: number;
}> = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeModified(value: unknown, locale: string): string {
  const ms = parseModifiedMs(value);
  if (ms == null) {
    return "—";
  }

  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffSeconds) < 45) {
    return formatter.format(0, "second");
  }

  for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return formatter.format(diffSeconds, "second");
}

export function formatModifiedAbsolute(value: unknown, locale: string): string | null {
  const ms = parseModifiedMs(value);
  if (ms == null) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function formatModifiedDisplay(
  value: unknown,
  locale: string,
  format: ModifiedTimeFormat,
): string {
  if (format === "absolute") {
    return formatModifiedAbsolute(value, locale) ?? "—";
  }
  return formatRelativeModified(value, locale);
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
