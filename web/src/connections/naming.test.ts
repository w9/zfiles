import assert from "node:assert/strict";
import test from "node:test";

import { suggestConnectionName, uniqueConnectionName } from "./naming";

test("suggestConnectionName names a connection after its bucket", () => {
  assert.equal(
    suggestConnectionName({
      provider: "aws",
      bucket: "my-data",
      region: "us-east-1",
      prefix: "",
      readOnly: false,
    }),
    "my-data",
  );
});

test("suggestConnectionName includes the prefix when the bucket is scoped", () => {
  assert.equal(
    suggestConnectionName({
      provider: "r2",
      bucket: "my-data",
      region: "auto",
      prefix: "photos/",
      readOnly: false,
    }),
    "my-data/photos",
  );
});

test("suggestConnectionName falls back to the provider without a bucket", () => {
  assert.equal(
    suggestConnectionName({
      provider: "r2",
      bucket: "",
      region: "auto",
      prefix: "",
      readOnly: false,
    }),
    "Cloudflare R2",
  );
  assert.equal(
    suggestConnectionName({
      provider: "aws",
      bucket: "",
      region: "us-east-1",
      prefix: "",
      readOnly: false,
    }),
    "Amazon S3",
  );
});

test("uniqueConnectionName leaves a free name alone", () => {
  assert.equal(uniqueConnectionName("my-data", ["other"]), "my-data");
});

test("uniqueConnectionName suffixes collisions case-insensitively", () => {
  assert.equal(uniqueConnectionName("my-data", ["My-Data"]), "my-data 2");
  assert.equal(uniqueConnectionName("my-data", ["my-data", "my-data 2"]), "my-data 3");
});

test("uniqueConnectionName trims and rejects blank names", () => {
  assert.equal(uniqueConnectionName("  spaced  ", []), "spaced");
  assert.equal(uniqueConnectionName("   ", ["Connection"]), "Connection 2");
});
