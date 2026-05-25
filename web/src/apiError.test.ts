import assert from "node:assert/strict";
import { test } from "node:test";

import { mapApiErrorBody } from "./apiError";

const t = (key: string) => key;

test("mapApiErrorBody maps path escape message", () => {
  assert.equal(
    mapApiErrorBody("path escapes served directory", t),
    "error.pathEscapesRoot",
  );
});

test("mapApiErrorBody returns null for unknown errors", () => {
  assert.equal(mapApiErrorBody("something else", t), null);
});
