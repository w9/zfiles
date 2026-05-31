import type { FileEntry } from "@/backend/types";
import type { ListingEntry } from "@/listing-types";
import { foldersFirstEnabled, type ListingSortOrder } from "@/settings/listingSortOrder";

export function compareNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function compareListingEntries(
  left: ListingEntry,
  right: ListingEntry,
  order: ListingSortOrder,
  tieBreaker: (left: ListingEntry, right: ListingEntry) => number,
): number {
  if (foldersFirstEnabled(order) && left.isDir !== right.isDir) {
    return left.isDir ? -1 : 1;
  }
  return tieBreaker(left, right);
}

export function compareFileEntries(
  left: FileEntry,
  right: FileEntry,
  order: ListingSortOrder,
): number {
  if (foldersFirstEnabled(order) && left.is_dir !== right.is_dir) {
    return left.is_dir ? -1 : 1;
  }
  return compareNames(left.name, right.name);
}

export function sortFileEntries(
  entries: FileEntry[],
  order: ListingSortOrder,
): FileEntry[] {
  return [...entries].sort((left, right) => compareFileEntries(left, right, order));
}
