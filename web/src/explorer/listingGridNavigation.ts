export type GridMoveDirection = "left" | "right" | "up" | "down";

export type GridIndexMoveOptions = {
  folderCount?: number;
};

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

export function moveSectionedGridIndex(
  index: number,
  direction: GridMoveDirection,
  columnCount: number,
  length: number,
  folderCount: number,
): number {
  if (length <= 0 || columnCount <= 0) {
    return 0;
  }

  const safeIndex = Math.min(Math.max(index, 0), length - 1);
  const fileStart = folderCount;
  const inFolders = safeIndex < folderCount;
  const sectionStart = inFolders ? 0 : fileStart;
  const sectionEnd = inFolders ? folderCount : length;
  const localIndex = safeIndex - sectionStart;
  const column = localIndex % columnCount;

  switch (direction) {
    case "left":
      if (column === 0) {
        return safeIndex;
      }
      return safeIndex - 1;
    case "right":
      if (column >= columnCount - 1 || safeIndex + 1 >= sectionEnd) {
        return safeIndex;
      }
      return safeIndex + 1;
    case "down": {
      const nextInSection = safeIndex + columnCount;
      if (nextInSection < sectionEnd) {
        return nextInSection;
      }
      if (inFolders) {
        const target = fileStart + column;
        return target < length ? target : safeIndex;
      }
      return safeIndex;
    }
    case "up": {
      const nextInSection = safeIndex - columnCount;
      if (nextInSection >= sectionStart) {
        return nextInSection;
      }
      if (!inFolders) {
        const folderRows = Math.ceil(folderCount / columnCount);
        const lastFolderRowStart = (folderRows - 1) * columnCount;
        for (let col = column; col >= 0; col -= 1) {
          const target = lastFolderRowStart + col;
          if (target < folderCount) {
            return target;
          }
        }
      }
      return safeIndex;
    }
  }
}

export function moveGridIndex(
  index: number,
  direction: GridMoveDirection,
  columnCount: number,
  length: number,
  options?: GridIndexMoveOptions,
): number {
  if (length <= 0 || columnCount <= 0) {
    return 0;
  }
  const folderCount = options?.folderCount;
  if (folderCount != null && folderCount > 0 && folderCount < length) {
    return moveSectionedGridIndex(
      index,
      direction,
      columnCount,
      length,
      folderCount,
    );
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
