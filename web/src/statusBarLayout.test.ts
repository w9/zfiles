import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STATUS_BAR_BADGE_CLASS,
  STATUS_BAR_ROW_HEIGHT_CLASS,
  STATUS_BAR_SEGMENT_CLASS,
  shouldCollapseStatusBarBadges,
} from "./statusBarLayout.ts";

describe("status bar layout constants", () => {
  it("pins the row and segment heights to a single line", () => {
    assert.match(STATUS_BAR_ROW_HEIGHT_CLASS, /\bh-6\b/);
    assert.match(STATUS_BAR_ROW_HEIGHT_CLASS, /\bmin-h-6\b/);
    assert.match(STATUS_BAR_ROW_HEIGHT_CLASS, /\bmax-h-6\b/);
    assert.match(STATUS_BAR_SEGMENT_CLASS, /\btruncate\b/);
    assert.match(STATUS_BAR_BADGE_CLASS, /\btext-sm\b/);
    assert.match(STATUS_BAR_BADGE_CLASS, /\bleading-none\b/);
  });
});

describe("shouldCollapseStatusBarBadges", () => {
  it("collapses only in compact touch chrome when dynamic status text is present", () => {
    assert.equal(shouldCollapseStatusBarBadges(false, "1 file selected", null), false);
    assert.equal(shouldCollapseStatusBarBadges(true, null, null), false);
    assert.equal(shouldCollapseStatusBarBadges(true, "1 file selected", null), true);
    assert.equal(
      shouldCollapseStatusBarBadges(true, null, "Cut 2 files"),
      true,
    );
    assert.equal(
      shouldCollapseStatusBarBadges(true, "1 file selected", "Cut 2 files"),
      true,
    );
  });
});
