import assert from "node:assert/strict";
import test from "node:test";

import { filterDownloadablePaths } from "./downloadPaths";

test("filterDownloadablePaths keeps files and drops directories", () => {
  const entries = [
    { path: "a.txt", name: "a.txt", is_dir: false, is_symlink: false, size: 1, modified: 0 },
    { path: "dir", name: "dir", is_dir: true, is_symlink: false, size: 0, modified: 0 },
    { path: "b.txt", name: "b.txt", is_dir: false, is_symlink: false, size: 2, modified: 0 },
  ];
  assert.deepEqual(
    filterDownloadablePaths(["a.txt", "dir", "b.txt", "missing"], entries),
    ["a.txt", "b.txt"],
  );
});
