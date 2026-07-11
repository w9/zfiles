import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldClearTouchSelectionOnBrowse,
  shouldClearTouchSelectionOutsideSelectionMode,
  shouldSkipDoubleClickActivate,
  shouldTouchTapActivate,
  keyboardFocusVisibleAfterListingMove,
  resolveListingFocusedPath,
  resolveLongPressGestureHighlightPath,
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

test("resolveListingFocusedPath hides focus highlight in touch UI", () => {
  assert.equal(
    resolveListingFocusedPath({ touchUi: true, selectedPath: "/a" }),
    null,
  );
  assert.equal(
    resolveListingFocusedPath({
      touchUi: false,
      selectedPath: "/a",
      keyboardFocusVisible: true,
    }),
    "/a",
  );
  assert.equal(
    resolveListingFocusedPath({ touchUi: false, selectedPath: null }),
    null,
  );
});

test("resolveListingFocusedPath shows focus only when keyboard focus is visible", () => {
  assert.equal(
    resolveListingFocusedPath({
      touchUi: false,
      selectedPath: "/a",
      keyboardFocusVisible: false,
    }),
    null,
  );
  assert.equal(
    resolveListingFocusedPath({
      touchUi: false,
      selectedPath: "/a",
      keyboardFocusVisible: true,
    }),
    "/a",
  );
  assert.equal(
    resolveListingFocusedPath({
      touchUi: false,
      selectedPath: "/a",
    }),
    "/a",
  );
});

test("keyboardFocusVisibleAfterListingMove is true only for plain arrow moves", () => {
  assert.equal(keyboardFocusVisibleAfterListingMove(false), true);
  assert.equal(keyboardFocusVisibleAfterListingMove(true), false);
});

test("resolveLongPressGestureHighlightPath follows the finger with anchor fallback", () => {
  assert.equal(
    resolveLongPressGestureHighlightPath({
      targetPath: "/c",
      anchorPath: "/a",
    }),
    "/c",
  );
  assert.equal(
    resolveLongPressGestureHighlightPath({
      targetPath: null,
      anchorPath: "/a",
    }),
    "/a",
  );
});

test("touch press highlight uses the pressed path until long-press arms", () => {
  assert.equal(
    resolveLongPressGestureHighlightPath({
      targetPath: null,
      anchorPath: "/pressed",
    }),
    "/pressed",
  );
});

test("shouldClearTouchSelectionOutsideSelectionMode keeps context-menu target selected", () => {
  assert.equal(
    shouldClearTouchSelectionOutsideSelectionMode({
      touchUi: true,
      selectionMode: false,
      selectedCount: 1,
      lastPointerType: "touch",
      contextMenuOpen: true,
    }),
    false,
  );
  assert.equal(
    shouldClearTouchSelectionOutsideSelectionMode({
      touchUi: true,
      selectionMode: false,
      selectedCount: 1,
      lastPointerType: "touch",
      contextMenuOpen: false,
    }),
    true,
  );
});
