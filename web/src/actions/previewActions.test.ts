import assert from "node:assert/strict";
import test from "node:test";

import { defaultContextKeys } from "./contextKeys";
import { createPreviewActions } from "./previewActions";
import { evaluateWhen } from "./when";

test("preview.get-info is available without a selection", () => {
  const action = createPreviewActions(() => ({ toggleInfoDialog: () => {} }))[0]!;
  assert.equal(action.when, undefined);
  assert.equal(evaluateWhen(action.when, defaultContextKeys()), true);
  assert.equal(
    evaluateWhen(action.when, { ...defaultContextKeys(), "selection.count": 0 }),
    true,
  );
});

test("preview.get-info exposes Mod+I default keybinding", () => {
  const action = createPreviewActions(() => ({ toggleInfoDialog: () => {} }))[0]!;
  assert.equal(action.defaultKeybinding, "Mod+I");
});
