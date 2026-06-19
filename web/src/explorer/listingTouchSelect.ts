export function isTouchPointerType(pointerType: string): boolean {
  return pointerType === "touch";
}

export function shouldTouchTapActivate(options: {
  pointerType: string;
  selectionMode: boolean;
}): boolean {
  return isTouchPointerType(options.pointerType) && !options.selectionMode;
}

export function shouldClearTouchSelectionOnBrowse(options: {
  pointerType: string;
  selectionMode: boolean;
  selectedCount: number;
}): boolean {
  return (
    isTouchPointerType(options.pointerType) &&
    !options.selectionMode &&
    options.selectedCount > 0
  );
}

export function shouldSkipDoubleClickActivate(pointerType: string): boolean {
  return isTouchPointerType(pointerType);
}
