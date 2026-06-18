import assert from "node:assert/strict";
import test from "node:test";

import {
  GRID_GAP_PX,
} from "@/settings/gridCardSize";

import {
  buildGridVirtualRows,
  gridEntryContentRect,
  resolveGridSectionFolderCount,
  virtualRowIndexForEntryIndex,
} from "./gridListingLayout";
import { moveSectionedGridIndex } from "./listingGridNavigation";

const CARD = { width: 100, height: 120 };

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
