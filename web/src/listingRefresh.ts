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
