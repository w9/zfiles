import assert from "node:assert/strict";
import test from "node:test";

import {
  armedRangeSelection,
  longPressGestureAction,
  resolveArmedRangeMode,
} from "./listingTouchSelectGestures";

test("longPressGestureAction enters select mode when it is off", () => {
  assert.equal(
    longPressGestureAction({ selectionMode: false, hasPath: true }),
    "enter-select-mode",
  );
  assert.equal(
    longPressGestureAction({ selectionMode: false, hasPath: false }),
    "enter-select-mode",
  );
});

test("longPressGestureAction arms range select on items in select mode", () => {
  assert.equal(
    longPressGestureAction({ selectionMode: true, hasPath: true }),
    "arm-range",
  );
  assert.equal(
    longPressGestureAction({ selectionMode: true, hasPath: false }),
    "none",
  );
});

test("armedRangeSelection unions the range into the base selection", () => {
  const base = new Set(["/a", "/b"]);
  const next = armedRangeSelection(base, new Set(["/b", "/c"]));
  assert.deepEqual([...next].sort(), ["/a", "/b", "/c"]);
  assert.deepEqual([...base].sort(), ["/a", "/b"]);
});

test("armedRangeSelection with empty range keeps the base", () => {
  const next = armedRangeSelection(new Set(["/a"]), new Set());
  assert.deepEqual([...next], ["/a"]);
});

test("resolveArmedRangeMode picks add for unselected anchors and subtract for selected", () => {
  const base = new Set(["/a", "/b"]);
  assert.equal(resolveArmedRangeMode({ baseSelection: base, anchorPath: "/c" }), "add");
  assert.equal(resolveArmedRangeMode({ baseSelection: base, anchorPath: "/b" }), "subtract");
});

test("armedRangeSelection subtracts the range in subtract mode", () => {
  const base = new Set(["/a", "/b", "/c"]);
  const next = armedRangeSelection(base, new Set(["/b", "/c", "/d"]), "subtract");
  assert.deepEqual([...next], ["/a"]);
  assert.deepEqual([...base].sort(), ["/a", "/b", "/c"]);
});
