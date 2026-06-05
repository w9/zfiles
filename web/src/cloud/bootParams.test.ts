import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectBootMode,
  readBootParamsFromSearch,
  stripCredentialParamsFromSearch,
} from "./bootParams";

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
      accessKeyId: undefined,
      secretAccessKey: undefined,
      sessionToken: undefined,
    },
  );
});

test("readBootParamsFromSearch ignores unknown provider", () => {
  assert.equal(readBootParamsFromSearch("?provider=wasabi").provider, undefined);
});

test("readBootParamsFromSearch parses credential params", () => {
  assert.deepEqual(
    readBootParamsFromSearch(
      "?bucket=data&access_key_id=AKIA123&secret_access_key=sekret&session_token=tok",
    ),
    {
      provider: undefined,
      bucket: "data",
      region: undefined,
      endpoint: undefined,
      prefix: undefined,
      readOnly: undefined,
      accessKeyId: "AKIA123",
      secretAccessKey: "sekret",
      sessionToken: "tok",
    },
  );
});

test("readBootParamsFromSearch prefers camelCase credential aliases", () => {
  assert.equal(
    readBootParamsFromSearch("?accessKeyId=camel&access_key_id=snake").accessKeyId,
    "camel",
  );
});

test("stripCredentialParamsFromSearch removes credential params and keeps others", () => {
  const url = new URL(
    "https://files.example.com/?provider=aws&bucket=photos&accessKeyId=AKIA&secretAccessKey=sek&prefix=2024/",
  );
  assert.equal(
    stripCredentialParamsFromSearch(url),
    "/?provider=aws&bucket=photos&prefix=2024%2F",
  );
});

test("detectBootMode defaults to local in tests", () => {
  assert.equal(detectBootMode(), "local");
});
