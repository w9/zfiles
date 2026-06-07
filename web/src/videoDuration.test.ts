import assert from "node:assert/strict";
import test from "node:test";

import { formatVideoDuration } from "./videoDuration";

test("formatVideoDuration renders minutes and seconds", () => {
  assert.equal(formatVideoDuration(83), "1:23");
  assert.equal(formatVideoDuration(0), "0:00");
  assert.equal(formatVideoDuration(59.9), "0:59");
});

test("formatVideoDuration renders hours when needed", () => {
  assert.equal(formatVideoDuration(3661), "1:01:01");
});

test("formatVideoDuration rejects non-finite values", () => {
  assert.equal(formatVideoDuration(Number.NaN), null);
  assert.equal(formatVideoDuration(Number.POSITIVE_INFINITY), null);
});
