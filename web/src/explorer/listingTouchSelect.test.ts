import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldClearTouchSelectionOnBrowse,
  shouldSkipDoubleClickActivate,
  shouldTouchTapActivate,
} from "./listingTouchSelect";

test("shouldTouchTapActivate requires touch outside selection mode", () => {
  assert.equal(
    shouldTouchTapActivate({ pointerType: "touch", selectionMode: false }),
    true,
  );
  assert.equal(
    shouldTouchTapActivate({ pointerType: "touch", selectionMode: true }),
    false,
  );
  assert.equal(
    shouldTouchTapActivate({ pointerType: "mouse", selectionMode: false }),
    false,
  );
});

test("shouldClearTouchSelectionOnBrowse clears stale touch selection while browsing", () => {
  assert.equal(
    shouldClearTouchSelectionOnBrowse({
      pointerType: "touch",
      selectionMode: false,
      selectedCount: 2,
    }),
    true,
  );
  assert.equal(
    shouldClearTouchSelectionOnBrowse({
      pointerType: "touch",
      selectionMode: false,
      selectedCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldClearTouchSelectionOnBrowse({
      pointerType: "mouse",
      selectionMode: false,
      selectedCount: 2,
    }),
    false,
  );
});

test("shouldSkipDoubleClickActivate blocks touch double-tap activate", () => {
  assert.equal(shouldSkipDoubleClickActivate("touch"), true);
  assert.equal(shouldSkipDoubleClickActivate("mouse"), false);
  assert.equal(shouldSkipDoubleClickActivate("pen"), false);
});
