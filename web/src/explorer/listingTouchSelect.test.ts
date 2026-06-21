import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldClearTouchSelectionOnBrowse,
  shouldSkipDoubleClickActivate,
  shouldTouchTapActivate,
} from "./listingTouchSelect";

test("shouldTouchTapActivate requires touch UI outside selection mode", () => {
  assert.equal(
    shouldTouchTapActivate({ touchUi: true, selectionMode: false }),
    true,
  );
  assert.equal(
    shouldTouchTapActivate({ touchUi: true, selectionMode: true }),
    false,
  );
  assert.equal(
    shouldTouchTapActivate({ touchUi: false, selectionMode: false }),
    false,
  );
});

test("shouldClearTouchSelectionOnBrowse clears stale touch selection while browsing", () => {
  assert.equal(
    shouldClearTouchSelectionOnBrowse({
      touchUi: true,
      selectionMode: false,
      selectedCount: 2,
    }),
    true,
  );
  assert.equal(
    shouldClearTouchSelectionOnBrowse({
      touchUi: true,
      selectionMode: false,
      selectedCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldClearTouchSelectionOnBrowse({
      touchUi: false,
      selectionMode: false,
      selectedCount: 2,
    }),
    false,
  );
});

test("shouldSkipDoubleClickActivate blocks double-tap activate in touch UI", () => {
  assert.equal(shouldSkipDoubleClickActivate(true), true);
  assert.equal(shouldSkipDoubleClickActivate(false), false);
});
