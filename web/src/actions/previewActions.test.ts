import assert from "node:assert/strict";
import test from "node:test";

import { defaultContextKeys } from "./contextKeys";
import { createPreviewActions } from "./previewActions";
import { evaluateWhen } from "./when";

test("preview.get-info requires at least one selected item", () => {
  const action = createPreviewActions(() => ({ toggleInfoDialog: () => {} }))[0]!;
  assert.equal(evaluateWhen(action.when!, defaultContextKeys()), false);
  assert.equal(
    evaluateWhen(action.when!, { ...defaultContextKeys(), "selection.count": 1 }),
    true,
  );
  assert.equal(
    evaluateWhen(action.when!, {
      ...defaultContextKeys(),
      "selection.count": 0,
      "preview.info-open": true,
    }),
    true,
  );
});

test("preview.get-info exposes Mod+I default keybinding", () => {
  const action = createPreviewActions(() => ({ toggleInfoDialog: () => {} }))[0]!;
  assert.equal(action.defaultKeybinding, "Mod+I");
});
