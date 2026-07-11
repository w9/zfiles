export function shouldTouchTapActivate(options: {
  touchUi: boolean;
  selectionMode: boolean;
}): boolean {
  return options.touchUi && !options.selectionMode;
}

export function shouldClearTouchSelectionOnBrowse(options: {
  touchUi: boolean;
  selectionMode: boolean;
  selectedCount: number;
}): boolean {
  return (
    options.touchUi &&
    !options.selectionMode &&
    options.selectedCount > 0
  );
}

export function shouldClearTouchSelectionOutsideSelectionMode(options: {
  touchUi: boolean;
  selectionMode: boolean;
  selectedCount: number;
  lastPointerType: string;
  contextMenuOpen: boolean;
}): boolean {
  return (
    shouldClearTouchSelectionOnBrowse({
      touchUi: options.touchUi,
      selectionMode: options.selectionMode,
      selectedCount: options.selectedCount,
    }) &&
    options.lastPointerType === "touch" &&
    !options.contextMenuOpen
  );
}

export function shouldSkipDoubleClickActivate(touchUi: boolean): boolean {
  return touchUi;
}

export function resolveListingFocusedPath(options: {
  touchUi: boolean;
  selectedPath: string | null;
  /** True only after plain arrow-key navigation (not range/pointer selection). */
  keyboardFocusVisible?: boolean;
}): string | null {
  if (options.touchUi || options.keyboardFocusVisible === false) {
    return null;
  }
  return options.selectedPath;
}

/** Show keyboard focus chrome for plain arrow moves; hide for range extend. */
export function keyboardFocusVisibleAfterListingMove(
  extendRange: boolean,
): boolean {
  return !extendRange;
}

/** Active row under the finger during a touch press or armed long-press drag. */
export function resolveLongPressGestureHighlightPath(options: {
  targetPath: string | null;
  anchorPath: string;
}): string {
  return options.targetPath ?? options.anchorPath;
}
