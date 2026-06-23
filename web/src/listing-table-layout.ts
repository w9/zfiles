import type { Layout } from "react-resizable-panels";

import { LISTING_ICON_COLUMN_WIDTH_PX } from "@/listing-styles";

export const LISTING_RESIZABLE_COLUMN_IDS = ["name", "size", "modified"] as const;

export function listingDataCellGridColumn(columnIndex: number): number {
  return columnIndex * 2 + 2;
}

export function listingColumnGutterGridColumn(columnIndex: number): number {
  return columnIndex * 2 + 1;
}

export function layoutToListingRowGridTemplate(layout: Layout, containerWidth: number): string {
  const separatorCount = LISTING_RESIZABLE_COLUMN_IDS.length - 1;
  const available = containerWidth - separatorCount - LISTING_ICON_COLUMN_WIDTH_PX;
  if (available <= 0) {
    return `${LISTING_ICON_COLUMN_WIDTH_PX}px minmax(0, 2fr) 1px 6rem 1px 9rem`;
  }

  const tracks: string[] = [`${LISTING_ICON_COLUMN_WIDTH_PX}px`];
  LISTING_RESIZABLE_COLUMN_IDS.forEach((id, index) => {
    tracks.push(`${((layout[id] ?? 0) / 100) * available}px`);
    if (index < separatorCount) {
      tracks.push("1px");
    }
  });
  return tracks.join(" ");
}

export function prependIconColumnToMeasuredGridTemplate(measured: string): string {
  return `${LISTING_ICON_COLUMN_WIDTH_PX}px ${measured}`;
}
