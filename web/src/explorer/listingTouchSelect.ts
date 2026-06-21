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

export function shouldSkipDoubleClickActivate(touchUi: boolean): boolean {
  return touchUi;
}
