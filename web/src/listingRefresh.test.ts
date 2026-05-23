import assert from "node:assert/strict";
import test from "node:test";

import {
  selectedRowIndexForPath,
  shouldRefreshListing,
} from "./listingRefresh";

test("shouldRefreshListing ignores dotfolder and editor metadata paths", () => {
  assert.equal(shouldRefreshListing(".cursor/debug.log", ""), false);
  assert.equal(shouldRefreshListing(".zfiles/state.db", ""), false);
});

test("shouldRefreshListing refreshes top-level changes at listing root", () => {
  assert.equal(shouldRefreshListing("README.md", ""), true);
  assert.equal(shouldRefreshListing("web/src/App.tsx", ""), false);
});

test("shouldRefreshListing refreshes nested changes for the open directory", () => {
  assert.equal(shouldRefreshListing("web/src/App.tsx", "web"), true);
  assert.equal(shouldRefreshListing("README.md", "web"), false);
});

test("selectedRowIndexForPath accounts for parent row in subdirectories", () => {
  const entries = [{ path: "src/App.tsx" }, { path: "package.json" }];
  assert.equal(selectedRowIndexForPath("", entries, "package.json"), 1);
  assert.equal(selectedRowIndexForPath("web", entries, "package.json"), 2);
});
