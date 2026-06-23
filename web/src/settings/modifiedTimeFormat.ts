export type ModifiedTimeFormat = "relative" | "absolute" | "combined";

export const MODIFIED_TIME_FORMAT_STORAGE_KEY = "zfiles-modified-time-format";

export const DEFAULT_MODIFIED_TIME_FORMAT: ModifiedTimeFormat = "relative";

export function parseModifiedTimeFormat(value: string | null): ModifiedTimeFormat {
  if (value === "absolute" || value === "combined") {
    return value;
  }
  return DEFAULT_MODIFIED_TIME_FORMAT;
}

export function readStoredModifiedTimeFormat(): ModifiedTimeFormat {
  if (typeof window === "undefined") {
    return DEFAULT_MODIFIED_TIME_FORMAT;
  }
  return parseModifiedTimeFormat(
    window.localStorage.getItem(MODIFIED_TIME_FORMAT_STORAGE_KEY),
  );
}

export function storeModifiedTimeFormat(format: ModifiedTimeFormat): void {
  window.localStorage.setItem(MODIFIED_TIME_FORMAT_STORAGE_KEY, format);
}
