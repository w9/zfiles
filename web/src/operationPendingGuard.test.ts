import assert from "node:assert/strict";
import test from "node:test";

import {
  isActionAllowedDuringOperationPending,
  isActionBlockedByOperationPending,
} from "./operationPendingGuard";

test("file mutations are blocked while an operation is pending", () => {
  assert.equal(isActionBlockedByOperationPending(true, "file.delete"), true);
  assert.equal(isActionBlockedByOperationPending(true, "file.paste"), true);
  assert.equal(isActionBlockedByOperationPending(true, "selection.download"), true);
});

test("local-only actions stay available while an operation is pending", () => {
  assert.equal(isActionAllowedDuringOperationPending("file.copy"), true);
  assert.equal(isActionBlockedByOperationPending(true, "file.copy"), false);
  assert.equal(isActionBlockedByOperationPending(true, "selection.move-down"), false);
});

test("nothing is blocked when no operation is pending", () => {
  assert.equal(isActionBlockedByOperationPending(false, "file.delete"), false);
});
