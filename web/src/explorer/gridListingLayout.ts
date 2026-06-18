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
  virtualRows: GridVirtualRow[];
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

export function gridEntryContentRect(
  entryIndex: number,
  metrics: GridListingLayoutMetrics,
): { top: number; left: number; width: number; height: number } | null {
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
