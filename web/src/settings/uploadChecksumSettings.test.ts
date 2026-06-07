import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultUploadChecksumValidation,
  parseUploadChecksumValidation,
  uploadChecksumValidationEnabled,
} from "./uploadChecksumSettings";

test("defaultUploadChecksumValidation is enabled", () => {
  assert.equal(defaultUploadChecksumValidation(), true);
});

test("parseUploadChecksumValidation accepts boolean strings", () => {
  assert.equal(parseUploadChecksumValidation("true"), true);
  assert.equal(parseUploadChecksumValidation("1"), true);
  assert.equal(parseUploadChecksumValidation("false"), false);
  assert.equal(parseUploadChecksumValidation("0"), false);
  assert.equal(parseUploadChecksumValidation(null), null);
  assert.equal(parseUploadChecksumValidation("maybe"), null);
});

test("uploadChecksumValidationEnabled is always false for R2", () => {
  assert.equal(uploadChecksumValidationEnabled("r2", true), false);
  assert.equal(uploadChecksumValidationEnabled("r2", false), false);
});

test("uploadChecksumValidationEnabled follows setting for AWS", () => {
  assert.equal(uploadChecksumValidationEnabled("aws", true), true);
  assert.equal(uploadChecksumValidationEnabled("aws", false), false);
});
