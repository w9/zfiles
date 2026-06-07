import assert from "node:assert/strict";
import test from "node:test";

import { slideshowNavDirection } from "./slideshowNavigation";

test("slideshowNavDirection maps arrows and hjkl to prev and next", () => {
  for (const key of ["ArrowLeft", "ArrowUp", "h", "H", "k", "K"]) {
    assert.equal(slideshowNavDirection(key), "prev");
  }
  for (const key of ["ArrowRight", "ArrowDown", "j", "J", "l", "L"]) {
    assert.equal(slideshowNavDirection(key), "next");
  }
  assert.equal(slideshowNavDirection("Escape"), null);
  assert.equal(slideshowNavDirection("Space"), null);
});
