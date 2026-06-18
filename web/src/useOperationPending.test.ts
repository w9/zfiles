import assert from "node:assert/strict";
import test from "node:test";

import { ASYNC_VISUAL_DELAY_MS } from "./asyncVisualDelay";

test("ASYNC_VISUAL_DELAY_MS matches listing overlay delay threshold", () => {
  assert.equal(ASYNC_VISUAL_DELAY_MS, 300);
});
