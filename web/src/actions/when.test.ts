import assert from "node:assert/strict";
import test from "node:test";

import { defaultContextKeys, type ContextKeys } from "./contextKeys";
import { evaluateWhen } from "./when";

const base: ContextKeys = {
  ...defaultContextKeys(),
  "focus.pane": "file-list",
  "selection.count": 2,
  "searcher.ready": true,
  "connection.online": true,
};

test("evaluateWhen returns true when expression omitted", () => {
  assert.equal(evaluateWhen(undefined, base), true);
  assert.equal(evaluateWhen("", base), true);
});

test("evaluateWhen compares numbers and booleans", () => {
  assert.equal(evaluateWhen("selection.count > 0", base), true);
  assert.equal(evaluateWhen("selection.count > 5", base), false);
  assert.equal(evaluateWhen("searcher.ready", base), true);
  assert.equal(evaluateWhen("!searcher.ready", base), false);
});

test("evaluateWhen supports string equality", () => {
  assert.equal(evaluateWhen("focus.pane == 'file-list'", base), true);
  assert.equal(evaluateWhen('focus.pane == "file-list"', base), true);
  assert.equal(evaluateWhen("focus.pane == 'search-input'", base), false);
});

test("evaluateWhen supports and expressions", () => {
  assert.equal(
    evaluateWhen("selection.count > 0 && connection.online", base),
    true,
  );
  assert.equal(
    evaluateWhen("selection.count > 0 && connection.online", {
      ...base,
      "connection.online": false,
    }),
    false,
  );
});

test("evaluateWhen supports boolean literal comparisons", () => {
  assert.equal(
    evaluateWhen("preview.is-image == true", {
      ...base,
      "preview.is-image": true,
      "preview.path": "photo.png",
    }),
    true,
  );
  assert.equal(
    evaluateWhen("preview.is-image == true", {
      ...base,
      "preview.is-image": false,
      "preview.path": "",
    }),
    false,
  );
});

test("evaluateWhen rejects unknown keys as false", () => {
  assert.equal(evaluateWhen("unknown.flag", base), false);
});
