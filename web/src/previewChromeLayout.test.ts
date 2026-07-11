import assert from "node:assert/strict";
import test from "node:test";

import { previewChromeRegion } from "./previewChromeLayout";

test("preview chrome places title and metadata at top; zoom and actions at bottom-end", () => {
  assert.equal(previewChromeRegion("title"), "top");
  assert.equal(previewChromeRegion("metadata"), "top");
  assert.equal(previewChromeRegion("zoom"), "bottom-end");
  assert.equal(previewChromeRegion("actions"), "bottom-end");
});
