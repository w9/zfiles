import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SHOW_DOT_ENTRIES,
  parseShowDotEntriesDefault,
  showDotEntriesFromDefault,
} from "./showDotEntriesDefault";

test("parseShowDotEntriesDefault defaults to hidden", () => {
  assert.equal(parseShowDotEntriesDefault(null), DEFAULT_SHOW_DOT_ENTRIES);
  assert.equal(parseShowDotEntriesDefault("invalid"), DEFAULT_SHOW_DOT_ENTRIES);
});

test("showDotEntriesFromDefault maps stored default", () => {
  assert.equal(showDotEntriesFromDefault("hidden"), false);
  assert.equal(showDotEntriesFromDefault("visible"), true);
});
