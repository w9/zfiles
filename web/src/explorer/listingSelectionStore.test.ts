import assert from "node:assert/strict";
import test from "node:test";

import {
  getListingSelectionPaths,
  listingPathIsSelected,
  setListingSelectionPaths,
  subscribeListingPathSelected,
} from "./listingSelectionStore";

test("setListingSelectionPaths notifies only membership changes", () => {
  setListingSelectionPaths(new Set());
  const seen: string[] = [];
  const unsubA = subscribeListingPathSelected("/a", () => {
    seen.push("/a");
  });
  const unsubB = subscribeListingPathSelected("/b", () => {
    seen.push("/b");
  });
  const unsubC = subscribeListingPathSelected("/c", () => {
    seen.push("/c");
  });

  setListingSelectionPaths(new Set(["/a", "/b"]));
  assert.deepEqual(seen.sort(), ["/a", "/b"]);
  seen.length = 0;

  setListingSelectionPaths(new Set(["/a", "/c"]));
  assert.deepEqual(seen.sort(), ["/b", "/c"]);
  assert.equal(listingPathIsSelected("/a"), true);
  assert.equal(listingPathIsSelected("/b"), false);
  assert.equal(getListingSelectionPaths().has("/c"), true);

  unsubA();
  unsubB();
  unsubC();
  setListingSelectionPaths(new Set());
});
