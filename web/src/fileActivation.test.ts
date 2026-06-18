import assert from "node:assert/strict";
import test from "node:test";

import { resolveFileActivation } from "./fileActivation";

test("resolveFileActivation previews image, video, audio, pdf, text, and markdown files", () => {
  assert.equal(resolveFileActivation("photo.png"), "preview");
  assert.equal(resolveFileActivation("clip.mp4"), "preview");
  assert.equal(resolveFileActivation("song.mp3"), "preview");
  assert.equal(resolveFileActivation("doc.pdf"), "preview");
  assert.equal(resolveFileActivation("notes.txt"), "preview");
  assert.equal(resolveFileActivation("page.html"), "preview");
  assert.equal(resolveFileActivation("README.md"), "preview");
  assert.equal(resolveFileActivation("icon.svg"), "preview");
});

test("resolveFileActivation downloads non-previewable files", () => {
  assert.equal(resolveFileActivation("archive.zip"), "download");
  assert.equal(resolveFileActivation("noext"), "download");
});
