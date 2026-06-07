import assert from "node:assert/strict";
import test from "node:test";

import { isBrowserPreviewImage, isBrowserPreviewVideo } from "./imagePaths";

test("isBrowserPreviewImage matches common raster extensions", () => {
  assert.equal(isBrowserPreviewImage("photo.jpg"), true);
  assert.equal(isBrowserPreviewImage("photo.JPEG"), true);
  assert.equal(isBrowserPreviewImage("photo.png"), true);
  assert.equal(isBrowserPreviewImage("clip.mp4"), false);
});

test("isBrowserPreviewVideo matches mp4 and webm only", () => {
  assert.equal(isBrowserPreviewVideo("clip.mp4"), true);
  assert.equal(isBrowserPreviewVideo("clip.WEBM"), true);
  assert.equal(isBrowserPreviewVideo("clip.mov"), false);
  assert.equal(isBrowserPreviewVideo("photo.jpg"), false);
});
