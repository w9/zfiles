import assert from "node:assert/strict";
import test from "node:test";

import {
  entryIndexForPath,
  swipeRangeFromAnchor,
} from "./listingSwipeRangeSelect";

test("swipeRangeFromAnchor spans anchor through target indices", () => {
  const entries = [{ path: "/a" }, { path: "/b" }, { path: "/c" }, { path: "/d" }];
  assert.deepEqual(
    [...swipeRangeFromAnchor(entries, 1, "/d")].sort(),
    ["/b", "/c", "/d"],
  );
  assert.deepEqual(
    [...swipeRangeFromAnchor(entries, 3, "/a")].sort(),
    ["/a", "/b", "/c", "/d"],
  );
});

test("swipeRangeFromAnchor falls back to anchor only for unknown target", () => {
  const entries = [{ path: "/a" }, { path: "/b" }];
  assert.deepEqual([...swipeRangeFromAnchor(entries, 1, "/missing")], ["/b"]);
  assert.deepEqual([...swipeRangeFromAnchor(entries, 1, null)], ["/b"]);
});

test("entryIndexForPath resolves listing order index", () => {
  const entries = [{ path: "/a" }, { path: "/b" }];
  assert.equal(entryIndexForPath(entries, "/b"), 1);
  assert.equal(entryIndexForPath(entries, "/z"), -1);
});
