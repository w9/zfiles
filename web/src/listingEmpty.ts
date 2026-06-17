export type ListingOverlayMessageKey = "listing.empty" | "quickFilter.empty";

export type ListingPaneOverlayKey = ListingOverlayMessageKey | "listing.loading";

export const LISTING_LOADING_OVERLAY_DELAY_MS = 300;

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

/** Listing pane overlay — loading spinner takes precedence over empty states. */
export function listingPaneOverlayKey(options: {
  showListingLoadingOverlay: boolean;
  listingLoaded: boolean;
  quickFilterActive: boolean;
  visibleEntryCount: number;
  filteredEntryCount: number;
}): ListingPaneOverlayKey | null {
  if (options.showListingLoadingOverlay) {
    return "listing.loading";
  }
  return listingOverlayMessageKey(options);
}
