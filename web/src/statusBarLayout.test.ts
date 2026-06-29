import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldCollapseStatusBarBadges } from "./statusBarLayout.ts";

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
