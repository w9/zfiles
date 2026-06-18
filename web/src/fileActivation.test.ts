import assert from "node:assert/strict";
import test from "node:test";

import { resolveFileActivation } from "./fileActivation";

test("resolveFileActivation previews image, video, and audio files", () => {
  assert.equal(resolveFileActivation("photo.png"), "preview");
  assert.equal(resolveFileActivation("clip.mp4"), "preview");
  assert.equal(resolveFileActivation("song.mp3"), "preview");
});

test("resolveFileActivation downloads non-previewable files", () => {
  assert.equal(resolveFileActivation("archive.zip"), "download");
  assert.equal(resolveFileActivation("doc.pdf"), "download");
  assert.equal(resolveFileActivation("notes.txt"), "download");
});
