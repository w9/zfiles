import assert from "node:assert/strict";
import { test } from "node:test";

import type { HttpRequest } from "@smithy/types";

import {
  aggregateMultipartBytesInFlight,
  runWithConcurrency,
  uploadPartNumberFromRequest,
} from "./s3XhrUploadProgress";

test("uploadPartNumberFromRequest reads partNumber query param", () => {
  assert.equal(
    uploadPartNumberFromRequest({ query: { partNumber: "3" } } as HttpRequest),
    3,
  );
  assert.equal(uploadPartNumberFromRequest({ query: {} } as HttpRequest), null);
});

test("aggregateMultipartBytesInFlight sums committed and in-flight bytes", () => {
  assert.equal(
    aggregateMultipartBytesInFlight(
      1_000,
      new Map([
        [2, 500],
        [3, 250],
      ]),
    ),
    1_750,
  );
});

test("runWithConcurrency preserves result order with limited workers", async () => {
  let active = 0;
  let maxActive = 0;
  const results = await runWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(maxActive, 2);
});
