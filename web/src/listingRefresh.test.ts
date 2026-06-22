import assert from "node:assert/strict";
import test from "node:test";

import {
  restoreSelectionFromListing,
  selectedRowIndexForPath,
  selectionSnapshotForRefresh,
  shouldRefreshListing,
} from "./listingRefresh";

test("shouldRefreshListing ignores dotfolder and editor metadata paths", () => {
  assert.equal(shouldRefreshListing(".cursor/debug.log", ""), false);
  assert.equal(shouldRefreshListing(".zfiles/uploads/id.meta.json", ""), false);
});

test("shouldRefreshListing refreshes top-level changes at listing root", () => {
  assert.equal(shouldRefreshListing("README.md", ""), true);
  assert.equal(shouldRefreshListing("web/src/App.tsx", ""), false);
});

test("shouldRefreshListing refreshes nested changes for the open directory", () => {
  assert.equal(shouldRefreshListing("web/src/App.tsx", "web"), true);
  assert.equal(shouldRefreshListing("README.md", "web"), false);
});

test("selectedRowIndexForPath returns the matching row index", () => {
  const entries = [{ path: "src/App.tsx" }, { path: "package.json" }];
  assert.equal(selectedRowIndexForPath(entries, "package.json"), 1);
  assert.equal(selectedRowIndexForPath(entries, "missing"), null);
});

test("selectionSnapshotForRefresh ignores focus path when nothing is selected", () => {
  const snapshot = selectionSnapshotForRefresh(new Set(), "first.txt");
  assert.equal(snapshot.previousPaths.size, 0);
  assert.equal(snapshot.focusPath, null);
});

test("selectionSnapshotForRefresh keeps selected paths and focus path", () => {
  const snapshot = selectionSnapshotForRefresh(new Set(["a", "b"]), "b");
  assert.deepEqual(snapshot.previousPaths, new Set(["a", "b"]));
  assert.equal(snapshot.focusPath, "b");
});

test("restoreSelectionFromListing keeps all paths that still exist", () => {
  const entries = [{ path: "a" }, { path: "b" }, { path: "c" }];
  const restored = restoreSelectionFromListing(
    entries,
    new Set(["a", "b", "missing"]),
    "b",
  );
  assert.deepEqual(restored?.paths, new Set(["a", "b"]));
  assert.equal(restored?.focusPath, "b");
  assert.equal(restored?.index, 1);
});
