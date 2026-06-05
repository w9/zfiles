import { test } from "node:test";
import assert from "node:assert/strict";

import { uniqueSiblingName } from "./paths";

test("uniqueSiblingName appends increment before extension", () => {
  const existing = new Set(["notes.txt", "notes (1).txt"]);
  assert.equal(uniqueSiblingName("notes.txt", existing), "notes (2).txt");
});
