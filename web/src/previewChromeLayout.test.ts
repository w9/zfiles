import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_CHROME_LABEL_WRAP_CLASS,
  PREVIEW_CHROME_STACK_CLASS,
  previewChromeRegion,
} from "./previewChromeLayout";

test("preview chrome places title and metadata at top; zoom and actions at bottom-end", () => {
  assert.equal(previewChromeRegion("title"), "top");
  assert.equal(previewChromeRegion("metadata"), "top");
  assert.equal(previewChromeRegion("zoom"), "bottom-end");
  assert.equal(previewChromeRegion("actions"), "bottom-end");
});

test("preview chrome labels clamp to two lines and break long tokens", () => {
  assert.match(PREVIEW_CHROME_LABEL_WRAP_CLASS, /\bline-clamp-2\b/);
  assert.match(PREVIEW_CHROME_LABEL_WRAP_CLASS, /\bbreak-all\b/);
  assert.doesNotMatch(PREVIEW_CHROME_LABEL_WRAP_CLASS, /\btruncate\b/);
});

test("preview chrome stack sits above preview media", () => {
  assert.match(PREVIEW_CHROME_STACK_CLASS, /\bz-10\b/);
});
