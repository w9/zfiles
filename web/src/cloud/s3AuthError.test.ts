import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CloudCredentialsAuthError,
  isCloudCredentialsAuthError,
  toCloudCredentialsAuthError,
} from "./s3AuthError";

test("toCloudCredentialsAuthError classifies explicit auth failures", () => {
  const expired = toCloudCredentialsAuthError({
    name: "ExpiredToken",
    message: "The provided token has expired.",
    $metadata: { httpStatusCode: 400 },
  });
  assert.ok(expired instanceof CloudCredentialsAuthError);
  assert.equal(expired.code, "ExpiredToken");

  const forbidden = toCloudCredentialsAuthError({
    name: "AccessDenied",
    message: "Access Denied",
    $metadata: { httpStatusCode: 403 },
  });
  assert.ok(forbidden instanceof CloudCredentialsAuthError);
  assert.equal(forbidden.statusCode, 403);
});

test("toCloudCredentialsAuthError ignores non-auth and empty-success values", () => {
  assert.equal(toCloudCredentialsAuthError(new Error("object not found: a.txt")), null);
  assert.equal(
    toCloudCredentialsAuthError({
      $metadata: { httpStatusCode: 200 },
      Contents: [],
      CommonPrefixes: [],
    }),
    null,
  );
});

test("isCloudCredentialsAuthError recognizes wrapped errors", () => {
  const auth = new CloudCredentialsAuthError("Credentials expired", {
    cause: new Error("ExpiredToken"),
    code: "ExpiredToken",
  });
  assert.equal(isCloudCredentialsAuthError(auth), true);
  assert.equal(isCloudCredentialsAuthError(new Error("ExpiredToken")), false);
});
