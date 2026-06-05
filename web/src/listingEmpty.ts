export type ListingOverlayMessageKey = "listing.empty" | "quickFilter.empty";

/** Centered listing overlay when there are no rows to show after filtering. */
export function listingOverlayMessageKey(options: {
  listingLoaded: boolean;
  quickFilterActive: boolean;
  visibleEntryCount: number;
  filteredEntryCount: number;
}): ListingOverlayMessageKey | null {
  const { listingLoaded, quickFilterActive, visibleEntryCount, filteredEntryCount } =
    options;
  if (!listingLoaded || filteredEntryCount > 0) {
    return null;
  }
  if (quickFilterActive && visibleEntryCount > 0) {
    return "quickFilter.empty";
  }
  return "listing.empty";
}
