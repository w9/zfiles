export type SelectAllWarningReason =
  | "hidden-dot-entries"
  | "quick-filter-active"
  | "more-to-load";

export function isListingFullySelected(
  visiblePaths: readonly string[],
  selectedPaths: ReadonlySet<string>,
): boolean {
  if (visiblePaths.length === 0) {
    return false;
  }
  return visiblePaths.every((path) => selectedPaths.has(path));
}

export function collectSelectAllWarnings(options: {
  quickFilterActive: boolean;
  quickFilteredCount: number;
  visibleEntryCount: number;
  hasHiddenDotEntries: boolean;
  hasMoreToLoad: boolean;
}): SelectAllWarningReason[] {
  const warnings: SelectAllWarningReason[] = [];
  if (options.hasHiddenDotEntries) {
    warnings.push("hidden-dot-entries");
  }
  if (
    options.quickFilterActive &&
    options.quickFilteredCount < options.visibleEntryCount
  ) {
    warnings.push("quick-filter-active");
  }
  if (options.hasMoreToLoad) {
    warnings.push("more-to-load");
  }
  return warnings;
}
