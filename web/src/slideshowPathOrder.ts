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
