import assert from "node:assert/strict";
import test from "node:test";

import { isPointerOverChrome, slideshowNavDirection } from "./slideshowNavigation";

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

test("isPointerOverChrome detects top and bottom zones", () => {
  const height = 800;
  const top = 112;
  const bottom = 128;
  assert.equal(isPointerOverChrome(0, height, top, bottom), true);
  assert.equal(isPointerOverChrome(top, height, top, bottom), true);
  assert.equal(isPointerOverChrome(top + 1, height, top, bottom), false);
  assert.equal(isPointerOverChrome(height / 2, height, top, bottom), false);
  assert.equal(isPointerOverChrome(height - bottom - 1, height, top, bottom), false);
  assert.equal(isPointerOverChrome(height - bottom, height, top, bottom), true);
  assert.equal(isPointerOverChrome(height, height, top, bottom), true);
});
