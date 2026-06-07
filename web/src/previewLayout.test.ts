import assert from "node:assert/strict";
import test from "node:test";

import {
  LG_BREAKPOINT_PX,
  PREVIEW_INLINE_MAX_CONTENT_FRACTION,
  PREVIEW_PANEL_WIDTH_PX,
  canShowInlinePreviewPanel,
} from "./previewLayout";

test("canShowInlinePreviewPanel requires lg viewport", () => {
  assert.equal(
    canShowInlinePreviewPanel(2000, LG_BREAKPOINT_PX - 1),
    false,
  );
});

test("canShowInlinePreviewPanel allows inline when panel is at most 40% of main content", () => {
  const minWidth = PREVIEW_PANEL_WIDTH_PX / PREVIEW_INLINE_MAX_CONTENT_FRACTION;
  assert.equal(canShowInlinePreviewPanel(minWidth, LG_BREAKPOINT_PX), true);
  assert.equal(canShowInlinePreviewPanel(minWidth - 1, LG_BREAKPOINT_PX), false);
});
