import assert from "node:assert/strict";
import test from "node:test";

import {
  entryIndexForPath,
  shouldApplySwipeRangeSelection,
  shouldHandleSwipeRangeSelect,
  swipeRangeFromAnchor,
} from "./listingSwipeRangeSelect";

test("shouldHandleSwipeRangeSelect requires selection mode, touch UI, and touch on listing entry", () => {
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
      touchUi: true,
      pointerType: "touch",
      target: entry,
    }),
    true,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: false,
      touchUi: true,
      pointerType: "touch",
      target: entry,
    }),
    false,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: true,
      touchUi: false,
      pointerType: "touch",
      target: entry,
    }),
    false,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: true,
      touchUi: true,
      pointerType: "mouse",
      target: entry,
    }),
    false,
  );
  assert.equal(
    shouldHandleSwipeRangeSelect({
      selectionMode: true,
      touchUi: true,
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

test("shouldApplySwipeRangeSelection skips single-item tap jitter", () => {
  assert.equal(
    shouldApplySwipeRangeSelection({
      nextSelection: new Set(["/b"]),
      pointerDistancePx: 20,
    }),
    false,
  );
  assert.equal(
    shouldApplySwipeRangeSelection({
      nextSelection: new Set(["/b"]),
      pointerDistancePx: 8,
    }),
    false,
  );
});

test("shouldApplySwipeRangeSelection requires minimum travel for multi-item range", () => {
  assert.equal(
    shouldApplySwipeRangeSelection({
      nextSelection: new Set(["/b", "/c", "/d"]),
      pointerDistancePx: 8,
    }),
    false,
  );
  assert.equal(
    shouldApplySwipeRangeSelection({
      nextSelection: new Set(["/b", "/c", "/d"]),
      pointerDistancePx: 16,
    }),
    true,
  );
});
