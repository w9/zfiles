export type ListingViewMode = "table" | "grid";

const STORAGE_KEY = "zfiles-listing-view";

function storage(): Storage | null {
  return typeof globalThis.localStorage === "object" && globalThis.localStorage
    ? globalThis.localStorage
    : null;
}

export function readListingViewMode(): ListingViewMode {
  const stored = storage()?.getItem(STORAGE_KEY);
  return stored === "grid" ? "grid" : "table";
}

export function writeListingViewMode(mode: ListingViewMode): void {
  storage()?.setItem(STORAGE_KEY, mode);
}

export function nextListingViewMode(mode: ListingViewMode): ListingViewMode {
  return mode === "table" ? "grid" : "table";
}

export function toggleListingViewMode(mode: ListingViewMode): ListingViewMode {
  const next = nextListingViewMode(mode);
  writeListingViewMode(next);
  return next;
}
