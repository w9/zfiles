export type ShowDotEntriesDefault = "hidden" | "visible";

export const SHOW_DOT_ENTRIES_DEFAULT_STORAGE_KEY = "zfiles-show-dot-entries-default";

export const DEFAULT_SHOW_DOT_ENTRIES: ShowDotEntriesDefault = "hidden";

export function parseShowDotEntriesDefault(value: string | null): ShowDotEntriesDefault {
  if (value === "visible") {
    return "visible";
  }
  return DEFAULT_SHOW_DOT_ENTRIES;
}

export function readStoredShowDotEntriesDefault(): ShowDotEntriesDefault {
  if (typeof window === "undefined") {
    return DEFAULT_SHOW_DOT_ENTRIES;
  }
  return parseShowDotEntriesDefault(
    window.localStorage.getItem(SHOW_DOT_ENTRIES_DEFAULT_STORAGE_KEY),
  );
}

export function storeShowDotEntriesDefault(value: ShowDotEntriesDefault): void {
  window.localStorage.setItem(SHOW_DOT_ENTRIES_DEFAULT_STORAGE_KEY, value);
}

export function showDotEntriesFromDefault(value: ShowDotEntriesDefault): boolean {
  return value === "visible";
}
