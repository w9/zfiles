import assert from "node:assert/strict";
import { test } from "node:test";

import { ExplorerApp, KernelBackend, useExplorerBackend } from "./index";

test("explorer entry exports ExplorerApp and backend symbols", () => {
  assert.equal(typeof ExplorerApp, "function");
  assert.equal(typeof KernelBackend, "function");
  assert.equal(typeof useExplorerBackend, "function");
});
