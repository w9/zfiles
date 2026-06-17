import assert from "node:assert/strict";
import test from "node:test";

import { aggregateSelection } from "./infoSelectionSummary";

test("aggregateSelection counts files, folders, symlinks, and total size", () => {
  const entries = new Map([
    ["a.txt", { is_dir: false, is_symlink: false, size: 10 }],
    ["b.txt", { is_dir: false, is_symlink: true, size: 20 }],
    ["docs", { is_dir: true, is_symlink: false, size: 0 }],
  ]);

  assert.deepEqual(aggregateSelection(["a.txt", "b.txt", "docs", "missing"], entries), {
    totalCount: 4,
    fileCount: 3,
    folderCount: 1,
    symlinkCount: 1,
    totalSize: 30,
  });
});
