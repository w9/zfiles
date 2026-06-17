import assert from "node:assert/strict";
import test from "node:test";

import {
  countSelectedFileFolders,
  formatCutStatusLabel,
  formatInfoAggregateBreakdown,
  formatSelectionStatusLabel,
} from "./selectionStatusText";

const entries = new Map([
  ["a.txt", { is_dir: false, is_symlink: false, size: 1 }],
  ["docs", { is_dir: true, is_symlink: false, size: 0 }],
  ["photos", { is_dir: true, is_symlink: false, size: 0 }],
]);

const t = (key: string, params?: Record<string, string>) => {
  if (key === "selection.fileSelected") return "1 file selected";
  if (key === "selection.folderSelected") return "1 folder selected";
  if (key === "selection.filesSelected") return `${params?.count} files selected`;
  if (key === "selection.foldersSelected") return `${params?.count} folders selected`;
  if (key === "selection.fileUnit.one") return "1 file";
  if (key === "selection.fileUnit.many") return `${params?.count} files`;
  if (key === "selection.folderUnit.one") return "1 folder";
  if (key === "selection.folderUnit.many") return `${params?.count} folders`;
  if (key === "selection.breakdownSelected") {
    return `${params?.files}, ${params?.folders} selected`;
  }
  if (key === "preview.aggregate.breakdown") {
    return `${params?.files}, ${params?.folders}`;
  }
  if (key === "clipboard.cutOne") return `Ready to move: ${params?.name}`;
  if (key === "clipboard.cutManyFiles") return `Ready to move ${params?.count} files`;
  if (key === "clipboard.cutManyFolders") return `Ready to move ${params?.count} folders`;
  if (key === "clipboard.cutBreakdown") {
    return `Ready to move ${params?.files}, ${params?.folders}`;
  }
  throw new Error(`unexpected key: ${key}`);
};

test("countSelectedFileFolders splits files and folders", () => {
  assert.deepEqual(countSelectedFileFolders(["a.txt", "docs"], entries), {
    fileCount: 1,
    folderCount: 1,
  });
});

test("formatSelectionStatusLabel uses type-specific single labels", () => {
  assert.equal(
    formatSelectionStatusLabel({ fileCount: 1, folderCount: 0 }, t),
    "1 file selected",
  );
  assert.equal(
    formatSelectionStatusLabel({ fileCount: 0, folderCount: 1 }, t),
    "1 folder selected",
  );
});

test("formatSelectionStatusLabel uses homogeneous multi labels", () => {
  assert.equal(
    formatSelectionStatusLabel({ fileCount: 3, folderCount: 0 }, t),
    "3 files selected",
  );
  assert.equal(
    formatSelectionStatusLabel({ fileCount: 0, folderCount: 2 }, t),
    "2 folders selected",
  );
});

test("formatSelectionStatusLabel pluralizes each side of mixed breakdown", () => {
  assert.equal(
    formatSelectionStatusLabel({ fileCount: 1, folderCount: 11 }, t),
    "1 file, 11 folders selected",
  );
  assert.equal(
    formatSelectionStatusLabel({ fileCount: 2, folderCount: 1 }, t),
    "2 files, 1 folder selected",
  );
});

test("formatCutStatusLabel keeps name for a single cut item", () => {
  assert.equal(
    formatCutStatusLabel({ fileCount: 1, folderCount: 0 }, "a.txt", t),
    "Ready to move: a.txt",
  );
});

test("formatCutStatusLabel pluralizes each side of mixed breakdown", () => {
  assert.equal(
    formatCutStatusLabel({ fileCount: 2, folderCount: 0 }, null, t),
    "Ready to move 2 files",
  );
  assert.equal(
    formatCutStatusLabel({ fileCount: 0, folderCount: 2 }, null, t),
    "Ready to move 2 folders",
  );
  assert.equal(
    formatCutStatusLabel({ fileCount: 1, folderCount: 11 }, null, t),
    "Ready to move 1 file, 11 folders",
  );
});

test("formatInfoAggregateBreakdown pluralizes each side", () => {
  assert.equal(formatInfoAggregateBreakdown(1, 11, t), "1 file, 11 folders");
  assert.equal(formatInfoAggregateBreakdown(3, 0, t), "3 files, 0 folders");
});
