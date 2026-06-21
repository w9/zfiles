import type { FileEntry } from "../backend/types";

export type ListingNavigationSnapshot = {
  path: string;
  entries: FileEntry[];
  listCursor: string | undefined;
  listingLoaded: boolean;
};

export function captureListingNavigationSnapshot(options: {
  path: string;
  entries: FileEntry[];
  listCursor: string | undefined;
  listingLoaded: boolean;
}): ListingNavigationSnapshot {
  return {
    path: options.path,
    entries: options.entries.slice(),
    listCursor: options.listCursor,
    listingLoaded: options.listingLoaded,
  };
}
