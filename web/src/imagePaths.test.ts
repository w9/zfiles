import assert from "node:assert/strict";
import test from "node:test";

import {
  isBrowserPreviewImage,
  isBrowserPreviewVideo,
  isPreviewable,
  previewKind,
} from "./imagePaths";

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

test("previewKind classifies images, video, and audio", () => {
  assert.equal(previewKind("photo.jpg"), "image");
  assert.equal(previewKind("photo.PNG"), "image");
  assert.equal(previewKind("scan.heic"), "image");
  assert.equal(previewKind("raw.nef"), "image");
  assert.equal(previewKind("clip.mp4"), "video");
  assert.equal(previewKind("clip.MOV"), "video");
  assert.equal(previewKind("clip.webm"), "video");
  assert.equal(previewKind("clip.m4v"), "video");
  assert.equal(previewKind("clip.ogv"), "video");
  assert.equal(previewKind("song.mp3"), "audio");
  assert.equal(previewKind("song.FLAC"), "audio");
  assert.equal(previewKind("song.m4a"), "audio");
  assert.equal(previewKind("song.ogg"), "audio");
  assert.equal(previewKind("song.oga"), "audio");
});

test("previewKind returns null for not-yet-supported and unknown types", () => {
  assert.equal(previewKind("doc.pdf"), null);
  assert.equal(previewKind("notes.txt"), null);
  assert.equal(previewKind("page.html"), null);
  assert.equal(previewKind("vector.svg"), null);
  assert.equal(previewKind("archive.zip"), null);
  assert.equal(previewKind("noext"), null);
});

test("isPreviewable is true only for image/video/audio", () => {
  assert.equal(isPreviewable("photo.jpg"), true);
  assert.equal(isPreviewable("clip.webm"), true);
  assert.equal(isPreviewable("song.mp3"), true);
  assert.equal(isPreviewable("doc.pdf"), false);
  assert.equal(isPreviewable("archive.zip"), false);
});
