import assert from "node:assert/strict";
import test from "node:test";

import {
  GRID_GAP_PX,
} from "@/settings/gridCardSize";

import {
  buildGridVirtualRows,
  gridEntryContentRect,
  gridEntryHitExpand,
  gridEntryHitRect,
  resolveGridSectionFolderCount,
  virtualRowIndexForEntryIndex,
} from "./gridListingLayout";
import { moveSectionedGridIndex } from "./listingGridNavigation";

const CARD = { width: 100, height: 120 };

function plainMetrics(entryCount: number, columnCount: number) {
  return {
    columnCount,
    cardWidth: CARD.width,
    cardHeight: CARD.height,
    gap: GRID_GAP_PX,
    padding: 12,
    virtualRows: buildGridVirtualRows(entryCount, columnCount, 0),
  };
}

test("resolveGridSectionFolderCount requires folders-first and both types", () => {
  const entries = [
    { isDir: true },
    { isDir: true },
    { isDir: false },
  ];
  assert.equal(resolveGridSectionFolderCount(entries, "folders-first"), 2);
  assert.equal(resolveGridSectionFolderCount(entries, "mixed"), 0);
  assert.equal(resolveGridSectionFolderCount([{ isDir: true }], "folders-first"), 0);
  assert.equal(resolveGridSectionFolderCount([{ isDir: false }], "folders-first"), 0);
});

test("buildGridVirtualRows adds headers only when sectioned", () => {
  assert.deepEqual(buildGridVirtualRows(5, 4, 0), [
    { kind: "cards", entryStartIndex: 0, entryCount: 4 },
    { kind: "cards", entryStartIndex: 4, entryCount: 1 },
  ]);
  assert.deepEqual(buildGridVirtualRows(6, 4, 2), [
    { kind: "header", section: "folders" },
    { kind: "cards", entryStartIndex: 0, entryCount: 2 },
    { kind: "header", section: "files" },
    { kind: "cards", entryStartIndex: 2, entryCount: 4 },
  ]);
});

test("virtualRowIndexForEntryIndex maps entry indices to card rows", () => {
  const rows = buildGridVirtualRows(6, 3, 2);
  assert.equal(virtualRowIndexForEntryIndex(rows, 0), 1);
  assert.equal(virtualRowIndexForEntryIndex(rows, 2), 3);
});

test("gridEntryContentRect offsets file rows below folder section headers", () => {
  const virtualRows = buildGridVirtualRows(5, 4, 2);
  const metrics = {
    columnCount: 4,
    cardWidth: CARD.width,
    cardHeight: CARD.height,
    gap: GRID_GAP_PX,
    padding: 12,
    virtualRows,
  };
  const folder = gridEntryContentRect(1, metrics);
  const file = gridEntryContentRect(3, metrics);
  assert.ok(folder);
  assert.ok(file);
  assert.ok(file.top > folder.top);
});

test("gridEntryHitExpand splits inter-item gaps and leaves outer edges alone", () => {
  const metrics = plainMetrics(4, 2);
  const half = GRID_GAP_PX / 2;
  assert.deepEqual(gridEntryHitExpand(0, metrics), {
    top: 0,
    right: half,
    bottom: half,
    left: 0,
  });
  assert.deepEqual(gridEntryHitExpand(1, metrics), {
    top: 0,
    right: 0,
    bottom: half,
    left: half,
  });
  assert.deepEqual(gridEntryHitExpand(2, metrics), {
    top: half,
    right: half,
    bottom: 0,
    left: 0,
  });
  assert.deepEqual(gridEntryHitExpand(3, metrics), {
    top: half,
    right: 0,
    bottom: 0,
    left: half,
  });
});

test("gridEntryHitRect neighbors meet with no dead zone in the gap", () => {
  const metrics = plainMetrics(4, 2);
  const left = gridEntryHitRect(0, metrics)!;
  const right = gridEntryHitRect(1, metrics)!;
  assert.equal(left.left + left.width, right.left);
  const top = gridEntryHitRect(0, metrics)!;
  const bottom = gridEntryHitRect(2, metrics)!;
  assert.equal(top.top + top.height, bottom.top);
});

test("gridEntryHitExpand does not grow into section-header gaps", () => {
  const metrics = {
    columnCount: 2,
    cardWidth: CARD.width,
    cardHeight: CARD.height,
    gap: GRID_GAP_PX,
    padding: 12,
    virtualRows: buildGridVirtualRows(4, 2, 2),
  };
  // Last folder row sits above the files header — no bottom expand.
  assert.equal(gridEntryHitExpand(1, metrics)?.bottom, 0);
  // First file row sits below the files header — no top expand.
  assert.equal(gridEntryHitExpand(2, metrics)?.top, 0);
});

test("gridEntryHitRect keeps visual content rect when there is no neighbor", () => {
  const metrics = plainMetrics(1, 2);
  assert.deepEqual(gridEntryHitRect(0, metrics), gridEntryContentRect(0, metrics));
});

test("moveSectionedGridIndex crosses from folders to files on down", () => {
  assert.equal(moveSectionedGridIndex(1, "down", 4, 6, 2), 3);
});

test("moveSectionedGridIndex crosses from files to folders on up", () => {
  assert.equal(moveSectionedGridIndex(5, "up", 4, 6, 2), 1);
});

test("moveSectionedGridIndex does not wrap horizontally across sections", () => {
  assert.equal(moveSectionedGridIndex(1, "right", 4, 6, 2), 1);
  assert.equal(moveSectionedGridIndex(2, "left", 4, 6, 2), 2);
});
