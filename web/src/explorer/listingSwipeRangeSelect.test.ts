import assert from "node:assert/strict";
import test from "node:test";

import {
  entryIndexForPath,
  shouldHandleSwipeRangeSelect,
  swipeRangeFromAnchor,
} from "./listingSwipeRangeSelect";

test("shouldHandleSwipeRangeSelect requires selection mode and touch on listing entry", () => {
  const entry = {
    closest(selector: string) {
      return selector === "[data-listing-entry]" ? entry : null;
    },
    getAttribute(name: string) {
      return name === "data-listing-path" ? "/a" : null;
    },
  };

  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: true,
      pointerType: "touch",
      target: entry,
    }),
    true,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: false,
      pointerType: "touch",
      target: entry,
    }),
    false,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: true,
      pointerType: "mouse",
      target: entry,
    }),
    false,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: true,
      pointerType: "touch",
      target: { closest: () => null },
    }),
    false,
  );
});

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
