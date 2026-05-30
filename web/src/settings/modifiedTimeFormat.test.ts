import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MODIFIED_TIME_FORMAT,
  parseModifiedTimeFormat,
} from "./modifiedTimeFormat";

test("parseModifiedTimeFormat defaults to relative", () => {
  assert.equal(parseModifiedTimeFormat(null), DEFAULT_MODIFIED_TIME_FORMAT);
  assert.equal(parseModifiedTimeFormat("invalid"), DEFAULT_MODIFIED_TIME_FORMAT);
});

test("parseModifiedTimeFormat accepts absolute", () => {
  assert.equal(parseModifiedTimeFormat("absolute"), "absolute");
});
