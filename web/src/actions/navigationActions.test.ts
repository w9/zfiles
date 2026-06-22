import assert from "node:assert/strict";
import test from "node:test";

import { defaultContextKeys } from "./contextKeys";
import { createNavigationActions } from "./navigationActions";
import { evaluateWhen } from "./when";

test("navigation.back requires can-go-back", () => {
  const action = createNavigationActions(() => ({
    goBack: () => {},
    goForward: () => {},
    refreshListing: () => {},
    cancelListingLoad: () => {},
    focusQuickFilter: () => {},
  })).find((item) => item.id === "navigation.back");
  assert.ok(action);
  assert.equal(
    evaluateWhen(action!.when, { ...defaultContextKeys(), "navigation.can-go-back": false }),
    false,
  );
  assert.equal(
    evaluateWhen(action!.when, { ...defaultContextKeys(), "navigation.can-go-back": true }),
    true,
  );
});

test("navigation.focus-quick-filter exposes Mod+F default keybinding", () => {
  const action = createNavigationActions(() => ({
    goBack: () => {},
    goForward: () => {},
    refreshListing: () => {},
    cancelListingLoad: () => {},
    focusQuickFilter: () => {},
  })).find((item) => item.id === "navigation.focus-quick-filter");
  assert.equal(action?.defaultKeybinding, "Mod+F");
});
