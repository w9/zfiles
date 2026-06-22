export function shouldRefreshListing(changedPath: string, listingPath: string): boolean {
  const normalized = changedPath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    normalized === ".cursor" ||
    normalized.startsWith(".cursor/") ||
    normalized === ".zfiles" ||
    normalized.startsWith(".zfiles/")
  ) {
    return false;
  }
  if (listingPath === "") {
    return !normalized.includes("/");
  }
  return normalized === listingPath || normalized.startsWith(`${listingPath}/`);
}

export function selectedRowIndexForPath(
  entries: Array<{ path: string }>,
  selectedPath: string,
): number | null {
  const entryIndex = entries.findIndex((entry) => entry.path === selectedPath);
  if (entryIndex < 0) {
    return null;
  }
  return entryIndex;
}

export function selectionSnapshotForRefresh(
  selectedPaths: ReadonlySet<string>,
  selectedPath: string | null,
): { previousPaths: Set<string>; focusPath: string | null } {
  if (selectedPaths.size === 0) {
    return { previousPaths: new Set(), focusPath: null };
  }
  return {
    previousPaths: new Set(selectedPaths),
    focusPath: selectedPath,
  };
}

export function restoreSelectionFromListing(
  entries: Array<{ path: string }>,
  previousPaths: Set<string>,
  focusPath: string | null,
): { paths: Set<string>; focusPath: string; index: number } | null {
  const paths = new Set<string>();
  for (const path of previousPaths) {
    if (entries.some((entry) => entry.path === path)) {
      paths.add(path);
    }
  }
  if (paths.size === 0) {
    return null;
  }
  const nextFocusPath =
    focusPath && paths.has(focusPath) ? focusPath : (paths.values().next().value as string);
  const index = selectedRowIndexForPath(entries, nextFocusPath);
  if (index == null) {
    return null;
  }
  return { paths, focusPath: nextFocusPath, index };
}
