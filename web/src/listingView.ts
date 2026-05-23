export type ListingViewMode = "table" | "grid";

const STORAGE_KEY = "zfiles-listing-view";

export function readListingViewMode(): ListingViewMode {
  if (typeof window === "undefined") {
    return "table";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "grid" ? "grid" : "table";
}

export function writeListingViewMode(mode: ListingViewMode): void {
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function toggleListingViewMode(mode: ListingViewMode): ListingViewMode {
  const next = mode === "table" ? "grid" : "table";
  writeListingViewMode(next);
  return next;
}
