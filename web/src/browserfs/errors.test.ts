import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserFsError,
  browserFsErrorMessageKey,
  isBrowserFsError,
  toBrowserFsError,
} from "./errors";

test("BrowserFsError carries a machine-readable code", () => {
  const err = new BrowserFsError("not-found", "missing");
  assert.equal(err.code, "not-found");
  assert.equal(err.name, "BrowserFsError");
  assert.equal(err.message, "missing");
  assert.ok(err instanceof Error);
});

test("isBrowserFsError optionally matches a specific code", () => {
  const err = new BrowserFsError("already-exists");
  assert.equal(isBrowserFsError(err), true);
  assert.equal(isBrowserFsError(err, "already-exists"), true);
  assert.equal(isBrowserFsError(err, "not-found"), false);
  assert.equal(isBrowserFsError(new Error("boom")), false);
});

test("toBrowserFsError maps quota failures and passes others through", () => {
  const quota = toBrowserFsError(new DOMException("full", "QuotaExceededError"));
  assert.equal(quota.code, "quota-exceeded");

  const existing = new BrowserFsError("invalid-name");
  assert.equal(toBrowserFsError(existing), existing);

  const unknown = toBrowserFsError(new Error("boom"));
  assert.equal(unknown.code, "unavailable");
  assert.match(unknown.message, /boom/);
});

test("browserFsErrorMessageKey maps every code to a message", () => {
  const codes = [
    "not-found",
    "already-exists",
    "invalid-name",
    "into-descendant",
    "quota-exceeded",
    "unavailable",
  ] as const;
  const keys = codes.map((code) => browserFsErrorMessageKey(new BrowserFsError(code)));
  assert.equal(new Set(keys).size, codes.length);
  assert.equal(
    browserFsErrorMessageKey(new BrowserFsError("quota-exceeded")),
    "browserfs.error.quotaExceeded",
  );
  assert.equal(browserFsErrorMessageKey(new Error("boom")), null);
});
