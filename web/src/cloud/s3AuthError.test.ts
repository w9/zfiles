import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CloudCredentialsAuthError,
  isCloudCredentialsAuthError,
  isS3ObjectNotFoundError,
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

test("isS3ObjectNotFoundError recognizes missing-object responses", () => {
  assert.equal(
    isS3ObjectNotFoundError({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    }),
    true,
  );
  assert.equal(
    isS3ObjectNotFoundError({
      name: "AccessDenied",
      $metadata: { httpStatusCode: 403 },
    }),
    false,
  );
});

test("toCloudCredentialsAuthError classifies browser transport failures", () => {
  const xhr = toCloudCredentialsAuthError(
    new Error("XHR_HTTP_HANDLER_ERROR: [object ProgressEvent]"),
  );
  assert.ok(xhr instanceof CloudCredentialsAuthError);
  assert.equal(xhr.code, "NetworkError");

  const fetchFailure = toCloudCredentialsAuthError(
    new TypeError("Failed to fetch"),
  );
  assert.ok(fetchFailure instanceof CloudCredentialsAuthError);
  assert.equal(fetchFailure.code, "NetworkError");
});
