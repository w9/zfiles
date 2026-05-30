export type ShowDotEntriesVisibility = "hidden" | "visible";

export const SHOW_DOT_ENTRIES_STORAGE_KEY = "zfiles-show-dot-entries";

const LEGACY_SHOW_DOT_ENTRIES_STORAGE_KEY = "zfiles-show-dot-entries-default";

export const DEFAULT_SHOW_DOT_ENTRIES: ShowDotEntriesVisibility = "hidden";

export function parseShowDotEntriesVisibility(
  value: string | null,
): ShowDotEntriesVisibility {
  if (value === "visible") {
    return "visible";
  }
  return DEFAULT_SHOW_DOT_ENTRIES;
}

export function readStoredShowDotEntries(): ShowDotEntriesVisibility {
  if (typeof window === "undefined") {
    return DEFAULT_SHOW_DOT_ENTRIES;
  }
  const stored =
    window.localStorage.getItem(SHOW_DOT_ENTRIES_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SHOW_DOT_ENTRIES_STORAGE_KEY);
  return parseShowDotEntriesVisibility(stored);
}

export function storeShowDotEntries(value: ShowDotEntriesVisibility): void {
  window.localStorage.setItem(SHOW_DOT_ENTRIES_STORAGE_KEY, value);
  window.localStorage.removeItem(LEGACY_SHOW_DOT_ENTRIES_STORAGE_KEY);
}

export function showDotEntriesEnabled(value: ShowDotEntriesVisibility): boolean {
  return value === "visible";
}

export function toggleShowDotEntriesVisibility(
  value: ShowDotEntriesVisibility,
): ShowDotEntriesVisibility {
  return value === "visible" ? "hidden" : "visible";
}
