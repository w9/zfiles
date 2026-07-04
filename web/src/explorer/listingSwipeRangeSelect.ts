import { pathsInIndexRange } from "./listingSelection";

export function entryIndexForPath(
  entries: ReadonlyArray<{ path: string }>,
  path: string,
): number {
  return entries.findIndex((entry) => entry.path === path);
}

export function swipeRangeFromAnchor(
  entries: ReadonlyArray<{ path: string }>,
  anchorIndex: number,
  targetPath: string | null,
): Set<string> {
  if (targetPath == null) {
    return pathsInIndexRange(entries, anchorIndex, anchorIndex);
  }
  const targetIndex = entryIndexForPath(entries, targetPath);
  if (targetIndex < 0) {
    return pathsInIndexRange(entries, anchorIndex, anchorIndex);
  }
  return pathsInIndexRange(entries, anchorIndex, targetIndex);
}
