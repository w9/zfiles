import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPACT_TOUCH_CHROME_MAX_WIDTH_PX,
  isCompactTouchChromeLayout,
} from "./compactTouchChrome.ts";

describe("isCompactTouchChromeLayout", () => {
  it("activates only for touch UI at or below the compact breakpoint", () => {
    assert.equal(
      isCompactTouchChromeLayout(true, COMPACT_TOUCH_CHROME_MAX_WIDTH_PX),
      true,
    );
    assert.equal(
      isCompactTouchChromeLayout(true, COMPACT_TOUCH_CHROME_MAX_WIDTH_PX - 1),
      true,
    );
    assert.equal(
      isCompactTouchChromeLayout(true, COMPACT_TOUCH_CHROME_MAX_WIDTH_PX + 1),
      false,
    );
    assert.equal(
      isCompactTouchChromeLayout(false, COMPACT_TOUCH_CHROME_MAX_WIDTH_PX),
      false,
    );
  });
});
