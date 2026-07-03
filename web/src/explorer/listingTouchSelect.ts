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
}): string | null {
  return options.touchUi ? null : options.selectedPath;
}
