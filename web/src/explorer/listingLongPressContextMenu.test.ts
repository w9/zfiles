import assert from "node:assert/strict";
import test from "node:test";

import {
  isListingEntryPointerTarget,
  listingEntryPathFromTarget,
  shouldCancelLongPressOnMove,
  shouldHandleListingLongPress,
} from "./listingLongPressContextMenu";

test("shouldHandleListingLongPress requires touch UI and touch pointer", () => {
  assert.equal(
    shouldHandleListingLongPress({
      enabled: true,
      touchUi: true,
      pointerType: "touch",
    }),
    true,
  );
  assert.equal(
    shouldHandleListingLongPress({
      enabled: true,
      touchUi: false,
      pointerType: "touch",
    }),
    false,
  );
  assert.equal(
    shouldHandleListingLongPress({
      enabled: true,
      touchUi: true,
      pointerType: "mouse",
    }),
    false,
  );
  assert.equal(
    shouldHandleListingLongPress({
      enabled: false,
      touchUi: true,
      pointerType: "touch",
    }),
    false,
  );
});

test("shouldCancelLongPressOnMove respects move threshold", () => {
  assert.equal(
    shouldCancelLongPressOnMove({
      startX: 0,
      startY: 0,
      clientX: 5,
      clientY: 0,
      thresholdPx: 10,
    }),
    false,
  );
  assert.equal(
    shouldCancelLongPressOnMove({
      startX: 0,
      startY: 0,
      clientX: 10,
      clientY: 0,
      thresholdPx: 10,
    }),
    true,
  );
});

test("listingEntryPathFromTarget reads data-listing-path", () => {
  const entry = {
    closest(selector: string) {
      return selector === "[data-listing-entry]" ? entry : null;
    },
    getAttribute(name: string) {
      return name === "data-listing-path" ? "/docs/readme.txt" : null;
    },
  };

  assert.equal(listingEntryPathFromTarget(entry), "/docs/readme.txt");
  assert.equal(isListingEntryPointerTarget(entry), true);
  assert.equal(isListingEntryPointerTarget({ closest: () => null }), false);
});
