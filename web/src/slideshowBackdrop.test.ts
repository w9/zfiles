import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_CONTENT_SELECTOR,
  shouldClosePreviewOnBackdropClick,
} from "./slideshowBackdrop";

function mockElement(hasPreviewContentAncestor: boolean): Element {
  return {
    closest(selector: string) {
      if (hasPreviewContentAncestor && selector === PREVIEW_CONTENT_SELECTOR) {
        return {};
      }
      return null;
    },
  } as unknown as Element;
}

test("shouldClosePreviewOnBackdropClick closes on backdrop but not preview content", () => {
  assert.equal(shouldClosePreviewOnBackdropClick(mockElement(false)), true);
  assert.equal(shouldClosePreviewOnBackdropClick(mockElement(true)), false);
});

test("shouldClosePreviewOnBackdropClick ignores non-element targets", () => {
  assert.equal(shouldClosePreviewOnBackdropClick(null), false);
  assert.equal(shouldClosePreviewOnBackdropClick({}), false);
});

test("PREVIEW_CONTENT_SELECTOR is stable", () => {
  assert.equal(PREVIEW_CONTENT_SELECTOR, "[data-preview-content]");
});
