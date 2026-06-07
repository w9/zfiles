import assert from "node:assert/strict";
import test from "node:test";

import {
  collectSelectAllWarnings,
  isListingFullySelected,
} from "./listingSelectAll";

test("isListingFullySelected is false for empty visible paths", () => {
  assert.equal(isListingFullySelected([], new Set(["/a"])), false);
});

test("isListingFullySelected requires every visible path", () => {
  assert.equal(isListingFullySelected(["/a", "/b"], new Set(["/a", "/b"])), true);
  assert.equal(isListingFullySelected(["/a", "/b"], new Set(["/a"])), false);
});

test("collectSelectAllWarnings reports hidden dots, filter, and pagination", () => {
  assert.deepEqual(
    collectSelectAllWarnings({
      quickFilterActive: false,
      quickFilteredCount: 3,
      visibleEntryCount: 3,
      hasHiddenDotEntries: true,
      hasMoreToLoad: false,
    }),
    ["hidden-dot-entries"],
  );
  assert.deepEqual(
    collectSelectAllWarnings({
      quickFilterActive: true,
      quickFilteredCount: 1,
      visibleEntryCount: 3,
      hasHiddenDotEntries: false,
      hasMoreToLoad: true,
    }),
    ["quick-filter-active", "more-to-load"],
  );
});
