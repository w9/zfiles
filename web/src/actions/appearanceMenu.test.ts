import assert from "node:assert/strict";
import test from "node:test";

import {
  APPEARANCE_MENU_HIDDEN_ACTION_IDS,
  filterAppearanceMenuActions,
  shouldRenderAppearanceModeGroups,
  THEME_MENU_MODES,
  UI_MODE_MENU_MODES,
} from "./appearanceMenu";
import type { ActionDefinition } from "./types";

function stubAction(id: string): ActionDefinition {
  return {
    id,
    nameKey: id,
    categoryKey: "actions.appearance.category",
    handler: () => {},
  };
}

test("appearance menu mode lists cover light/dark/auto and mouse/touch/auto", () => {
  assert.deepEqual(THEME_MENU_MODES, ["light", "dark", "auto"]);
  assert.deepEqual(UI_MODE_MENU_MODES, ["mouse", "touch", "auto"]);
});

test("filterAppearanceMenuActions removes cycle/set theme and ui mode actions", () => {
  const items = [
    stubAction("appearance.cycle-theme"),
    stubAction("appearance.set-theme"),
    stubAction("appearance.cycle-ui-mode"),
    stubAction("appearance.set-ui-mode"),
    stubAction("appearance.set-locale"),
  ];
  const filtered = filterAppearanceMenuActions(items);
  assert.deepEqual(filtered.map((item) => item.id), ["appearance.set-locale"]);
  assert.equal(APPEARANCE_MENU_HIDDEN_ACTION_IDS.size, 4);
});

test("shouldRenderAppearanceModeGroups is true when hidden appearance actions exist", () => {
  assert.equal(
    shouldRenderAppearanceModeGroups([
      stubAction("appearance.cycle-theme"),
      stubAction("appearance.set-locale"),
    ]),
    true,
  );
  assert.equal(
    shouldRenderAppearanceModeGroups([stubAction("appearance.set-locale")]),
    false,
  );
});
