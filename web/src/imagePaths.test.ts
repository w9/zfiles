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

test("previewKind classifies images, video, audio, pdf, text, and markdown", () => {
  assert.equal(previewKind("photo.jpg"), "image");
  assert.equal(previewKind("photo.PNG"), "image");
  assert.equal(previewKind("scan.heic"), "image");
  assert.equal(previewKind("raw.nef"), "image");
  assert.equal(previewKind("vector.svg"), "image");
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
  assert.equal(previewKind("doc.pdf"), "pdf");
  assert.equal(previewKind("notes.txt"), "text");
  assert.equal(previewKind("page.html"), "text");
  assert.equal(previewKind("src/main.rs"), "text");
  assert.equal(previewKind("Dockerfile"), "text");
  assert.equal(previewKind("Makefile"), "text");
  assert.equal(previewKind("GNUmakefile"), "text");
  assert.equal(previewKind("LICENSE"), "text");
  assert.equal(previewKind("COPYING"), "text");
  assert.equal(previewKind("README"), "text");
  assert.equal(previewKind("project/LICENSE"), "text");
  assert.equal(previewKind("README.md"), "markdown");
  assert.equal(previewKind("guide.markdown"), "markdown");
});

test("previewKind returns null for unsupported types", () => {
  assert.equal(previewKind("archive.zip"), null);
  assert.equal(previewKind("noext"), null);
});

test("isPreviewable is true for all preview kinds", () => {
  assert.equal(isPreviewable("photo.jpg"), true);
  assert.equal(isPreviewable("clip.webm"), true);
  assert.equal(isPreviewable("song.mp3"), true);
  assert.equal(isPreviewable("doc.pdf"), true);
  assert.equal(isPreviewable("notes.txt"), true);
  assert.equal(isPreviewable("README.md"), true);
  assert.equal(isPreviewable("vector.svg"), true);
  assert.equal(isPreviewable("archive.zip"), false);
});
