export type GridMoveDirection = "left" | "right" | "up" | "down";

export function moveLinearIndex(
  index: number,
  delta: number,
  length: number,
): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(index + delta, 0), length - 1);
}

export function moveGridIndex(
  index: number,
  direction: GridMoveDirection,
  columnCount: number,
  length: number,
): number {
  if (length <= 0 || columnCount <= 0) {
    return 0;
  }
  const safeIndex = Math.min(Math.max(index, 0), length - 1);
  const row = Math.floor(safeIndex / columnCount);
  const col = safeIndex % columnCount;

  switch (direction) {
    case "left":
      if (col === 0) {
        return safeIndex;
      }
      return safeIndex - 1;
    case "right":
      if (col >= columnCount - 1 || safeIndex + 1 >= length) {
        return safeIndex;
      }
      return safeIndex + 1;
    case "up":
      if (row === 0) {
        return safeIndex;
      }
      return safeIndex - columnCount;
    case "down": {
      const next = safeIndex + columnCount;
      if (next >= length) {
        return safeIndex;
      }
      return next;
    }
  }
}
