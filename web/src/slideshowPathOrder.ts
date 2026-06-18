export function sortPathsByListingOrder(
  paths: string[],
  listingPaths: string[],
): string[] {
  const order = new Map(listingPaths.map((path, index) => [path, index]));
  return [...paths].sort((left, right) => {
    const leftIndex = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  });
}

function isListingFile(
  path: string,
  listingEntries: Array<{ path: string; isDir: boolean }>,
): boolean {
  const entry = listingEntries.find((item) => item.path === path);
  if (entry) {
    return !entry.isDir;
  }
  return true;
}

export function resolveViewerPreviewPaths(
  selectedPaths: string[],
  listingEntries: Array<{ path: string; isDir: boolean }>,
): string[] {
  const listingPaths = listingEntries.map((entry) => entry.path);
  if (selectedPaths.length > 0) {
    return sortPathsByListingOrder(
      selectedPaths.filter((path) => isListingFile(path, listingEntries)),
      listingPaths,
    );
  }
  return sortPathsByListingOrder(
    listingEntries.filter((entry) => !entry.isDir).map((entry) => entry.path),
    listingPaths,
  );
}

export function resolveSlideshowStartIndex(
  paths: string[],
  startPath: string | null,
  startAtActiveItem: boolean,
): number {
  if (!startAtActiveItem || !startPath || paths.length === 0) {
    return 0;
  }
  const index = paths.indexOf(startPath);
  return index >= 0 ? index : 0;
}
