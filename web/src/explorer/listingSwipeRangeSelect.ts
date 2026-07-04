import { pathsInIndexRange } from "./listingSelection";

export function shouldHandleSwipeRangeSelect(options: {
  selectionMode: boolean;
  touchUi: boolean;
  pointerType: string;
  target: EventTarget | null;
}): boolean {
  if (!options.selectionMode || !options.touchUi || options.pointerType !== "touch") {
    return false;
  }
  const target = options.target;
  if (
    target == null ||
    typeof target !== "object" ||
    typeof (target as Element).closest !== "function"
  ) {
    return false;
  }
  const entry = (target as Element).closest("[data-listing-entry]");
  if (!entry) {
    return false;
  }
  return entry.getAttribute("data-listing-path") != null;
}

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

/** Minimum finger travel before swipe range replaces selection (tap drift stays below this). */
export const SWIPE_RANGE_APPLY_THRESHOLD_PX = 12;

/** Skip swipe apply for tap jitter — let click toggle handle same-row taps. */
export function shouldApplySwipeRangeSelection(options: {
  nextSelection: ReadonlySet<string>;
  pointerDistancePx: number;
  thresholdPx?: number;
}): boolean {
  if (
    options.pointerDistancePx <
    (options.thresholdPx ?? SWIPE_RANGE_APPLY_THRESHOLD_PX)
  ) {
    return false;
  }
  return options.nextSelection.size > 1;
}
