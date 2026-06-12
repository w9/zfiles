import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canUseSinglePutUpload,
  missingPartNumbers,
  toCompletedPart,
} from "./s3MultipartUpload";

test("missingPartNumbers lists gaps in uploaded part numbers", () => {
  const completed = new Set([1, 3]);
  assert.deepEqual(missingPartNumbers(4, completed), [2, 4]);
  assert.deepEqual(missingPartNumbers(3, new Set([1, 2, 3])), []);
});

test("canUseSinglePutUpload allows PutObject only for fresh small files", () => {
  assert.equal(canUseSinglePutUpload(1024, 5 * 1024 * 1024, 0, false), true);
  assert.equal(canUseSinglePutUpload(10 * 1024 * 1024, 5 * 1024 * 1024, 0, false), false);
  assert.equal(canUseSinglePutUpload(1024, 5 * 1024 * 1024, 0, true), false);
  assert.equal(canUseSinglePutUpload(1024, 5 * 1024 * 1024, 1, false), false);
});

test("toCompletedPart carries checksum fields for CompleteMultipartUpload", () => {
  assert.deepEqual(
    toCompletedPart({
      PartNumber: 2,
      ETag: '"abc"',
      ChecksumSHA256: "deadbeef",
    }),
    {
      PartNumber: 2,
      ETag: '"abc"',
      ChecksumSHA256: "deadbeef",
    },
  );
});
