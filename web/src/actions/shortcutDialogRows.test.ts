import assert from "node:assert/strict";
import test from "node:test";

import { defaultKeybindings } from "./keybindings";
import {
  groupShortcutDialogRows,
  shortcutDialogRows,
} from "./shortcutDialogRows";
import type { ActionDefinition } from "./types";

const sampleActions: ActionDefinition[] = [
  {
    id: "view.open-command-palette",
    nameKey: "actions.view.openCommandPalette.name",
    categoryKey: "actions.view.category",
    handler: async () => {},
  },
  {
    id: "selection.move-down",
    nameKey: "actions.selection.moveDown.name",
    categoryKey: "actions.selection.category",
    handler: async () => {},
  },
];

test("shortcutDialogRows lists registered keybindings with action labels", () => {
  const rows = shortcutDialogRows(
    sampleActions,
    defaultKeybindings(),
    (key) => key,
  );

  assert.ok(rows.some((row) => row.chord === "Mod+P"));
  assert.ok(rows.some((row) => row.chord === "J"));
  assert.equal(
    rows.find((row) => row.chord === "Mod+P")?.actionLabel,
    "actions.view.openCommandPalette.name",
  );
});

test("groupShortcutDialogRows preserves category order", () => {
  const groups = groupShortcutDialogRows(
    shortcutDialogRows(sampleActions, defaultKeybindings(), (key) => key),
  );

  assert.deepEqual(
    groups.map((group) => group.categoryKey),
    ["actions.view.category", "actions.selection.category"],
  );
});
