import type { ListingSortOrder } from "@/settings/listingSortOrder";
import { foldersFirstEnabled } from "@/settings/listingSortOrder";

export const GRID_SECTION_HEADER_HEIGHT_PX = 28;
export const GRID_SECTION_HEADER_TOP_GAP_PX = 12;

export type GridVirtualRow =
  | { kind: "header"; section: "folders" | "files" }
  | { kind: "cards"; entryStartIndex: number; entryCount: number };

export type GridListingLayoutMetrics = {
  columnCount: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  padding: number;
  virtualRows: readonly GridVirtualRow[];
};

export function resolveGridSectionFolderCount(
  entries: ReadonlyArray<{ isDir: boolean }>,
  listingSortOrder: ListingSortOrder,
): number {
  if (!foldersFirstEnabled(listingSortOrder) || entries.length === 0) {
    return 0;
  }
  let folderCount = 0;
  for (const entry of entries) {
    if (entry.isDir) {
      folderCount += 1;
    } else {
      break;
    }
  }
  const fileCount = entries.length - folderCount;
  return folderCount > 0 && fileCount > 0 ? folderCount : 0;
}

function appendCardRows(
  rows: GridVirtualRow[],
  startIndex: number,
  count: number,
  columnCount: number,
): void {
  if (count <= 0 || columnCount <= 0) {
    return;
  }
  for (let offset = 0; offset < count; offset += columnCount) {
    rows.push({
      kind: "cards",
      entryStartIndex: startIndex + offset,
      entryCount: Math.min(columnCount, count - offset),
    });
  }
}

export function buildGridVirtualRows(
  entryCount: number,
  columnCount: number,
  sectionFolderCount: number,
): GridVirtualRow[] {
  if (entryCount <= 0 || columnCount <= 0) {
    return [];
  }

  const rows: GridVirtualRow[] = [];
  if (sectionFolderCount <= 0) {
    appendCardRows(rows, 0, entryCount, columnCount);
    return rows;
  }

  const fileCount = entryCount - sectionFolderCount;
  rows.push({ kind: "header", section: "folders" });
  appendCardRows(rows, 0, sectionFolderCount, columnCount);
  rows.push({ kind: "header", section: "files" });
  appendCardRows(rows, sectionFolderCount, fileCount, columnCount);
  return rows;
}

export function estimateGridVirtualRowSize(
  row: GridVirtualRow,
  cardHeight: number,
): number {
  if (row.kind === "header") {
    return row.section === "files"
      ? GRID_SECTION_HEADER_HEIGHT_PX + GRID_SECTION_HEADER_TOP_GAP_PX
      : GRID_SECTION_HEADER_HEIGHT_PX;
  }
  return cardHeight;
}

export function virtualRowIndexForEntryIndex(
  virtualRows: readonly GridVirtualRow[],
  entryIndex: number,
): number {
  for (let index = 0; index < virtualRows.length; index += 1) {
    const row = virtualRows[index];
    if (row.kind !== "cards") {
      continue;
    }
    if (
      entryIndex >= row.entryStartIndex &&
      entryIndex < row.entryStartIndex + row.entryCount
    ) {
      return index;
    }
  }
  return 0;
}

export type GridEntryRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** Half-gap insets that expand a card's hit target into neighboring inter-item gaps. */
export type GridEntryHitExpand = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function gridEntryContentRect(
  entryIndex: number,
  metrics: GridListingLayoutMetrics,
): GridEntryRect | null {
  const { columnCount, cardWidth, cardHeight, gap, padding, virtualRows } =
    metrics;
  if (columnCount <= 0) {
    return null;
  }

  const colStride = cardWidth + gap;
  let contentTop = padding;

  for (let rowIndex = 0; rowIndex < virtualRows.length; rowIndex += 1) {
    const row = virtualRows[rowIndex];
    const rowHeight = estimateGridVirtualRowSize(row, cardHeight);

    if (row.kind === "cards") {
      const rowEnd = row.entryStartIndex + row.entryCount;
      if (entryIndex >= row.entryStartIndex && entryIndex < rowEnd) {
        const column = entryIndex - row.entryStartIndex;
        return {
          top: contentTop,
          left: padding + column * colStride,
          width: cardWidth,
          height: cardHeight,
        };
      }
    }

    contentTop += rowHeight;
    if (rowIndex < virtualRows.length - 1) {
      contentTop += gap;
    }
  }

  return null;
}

/**
 * Hit-target expansion into inter-item gaps only: half the gap toward each
 * neighboring card. No expansion into viewport padding, blank trailing columns,
 * or gaps beside section headers.
 */
export function gridEntryHitExpand(
  entryIndex: number,
  metrics: GridListingLayoutMetrics,
): GridEntryHitExpand | null {
  const { columnCount, gap, virtualRows } = metrics;
  if (columnCount <= 0) {
    return null;
  }

  let cardRowIndex = -1;
  let column = -1;
  let entryCount = 0;
  for (let rowIndex = 0; rowIndex < virtualRows.length; rowIndex += 1) {
    const row = virtualRows[rowIndex]!;
    if (row.kind !== "cards") {
      continue;
    }
    const rowEnd = row.entryStartIndex + row.entryCount;
    if (entryIndex >= row.entryStartIndex && entryIndex < rowEnd) {
      cardRowIndex = rowIndex;
      column = entryIndex - row.entryStartIndex;
      entryCount = row.entryCount;
      break;
    }
  }
  if (cardRowIndex < 0) {
    return null;
  }

  const halfGap = gap > 0 ? gap / 2 : 0;
  const prev = cardRowIndex > 0 ? virtualRows[cardRowIndex - 1]! : null;
  const next =
    cardRowIndex < virtualRows.length - 1
      ? virtualRows[cardRowIndex + 1]!
      : null;

  return {
    top: prev?.kind === "cards" ? halfGap : 0,
    right: column < entryCount - 1 ? halfGap : 0,
    bottom: next?.kind === "cards" ? halfGap : 0,
    left: column > 0 ? halfGap : 0,
  };
}

/** Visual card bounds expanded into neighboring inter-item gaps for hit testing. */
export function gridEntryHitRect(
  entryIndex: number,
  metrics: GridListingLayoutMetrics,
): GridEntryRect | null {
  const visual = gridEntryContentRect(entryIndex, metrics);
  const expand = gridEntryHitExpand(entryIndex, metrics);
  if (!visual || !expand) {
    return null;
  }
  return {
    top: visual.top - expand.top,
    left: visual.left - expand.left,
    width: visual.width + expand.left + expand.right,
    height: visual.height + expand.top + expand.bottom,
  };
}
