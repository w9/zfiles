import assert from "node:assert/strict";
import { test } from "node:test";

import { detectBootMode, readBootParamsFromSearch } from "./bootParams";

test("readBootParamsFromSearch parses non-secret params", () => {
  assert.deepEqual(
    readBootParamsFromSearch(
      "?provider=r2&bucket=photos&region=auto&endpoint=https://example.r2.cloudflarestorage.com&prefix=uploads/&readonly=1",
    ),
    {
      provider: "r2",
      bucket: "photos",
      region: "auto",
      endpoint: "https://example.r2.cloudflarestorage.com",
      prefix: "uploads/",
      readOnly: true,
    },
  );
});

test("readBootParamsFromSearch ignores unknown provider", () => {
  assert.equal(readBootParamsFromSearch("?provider=wasabi").provider, undefined);
});

test("detectBootMode defaults to local in tests", () => {
  assert.equal(detectBootMode(), "local");
});
