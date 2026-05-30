import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SHOW_DOT_ENTRIES,
  parseShowDotEntriesVisibility,
  showDotEntriesEnabled,
  toggleShowDotEntriesVisibility,
} from "./showDotEntries";

test("parseShowDotEntriesVisibility defaults to hidden", () => {
  assert.equal(parseShowDotEntriesVisibility(null), DEFAULT_SHOW_DOT_ENTRIES);
  assert.equal(parseShowDotEntriesVisibility("invalid"), DEFAULT_SHOW_DOT_ENTRIES);
});

test("showDotEntriesEnabled maps stored visibility", () => {
  assert.equal(showDotEntriesEnabled("hidden"), false);
  assert.equal(showDotEntriesEnabled("visible"), true);
});

test("toggleShowDotEntriesVisibility flips hidden and visible", () => {
  assert.equal(toggleShowDotEntriesVisibility("hidden"), "visible");
  assert.equal(toggleShowDotEntriesVisibility("visible"), "hidden");
});
