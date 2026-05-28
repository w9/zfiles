import assert from "node:assert/strict";
import test from "node:test";

import { searchActions } from "./search";
import type { ActionDefinition } from "./types";

const actions: ActionDefinition[] = [
  {
    id: "view.open-command-palette",
    nameKey: "actions.view.openCommandPalette.name",
    categoryKey: "actions.view.category",
    handler: async () => {},
  },
  {
    id: "selection.copy-paths",
    nameKey: "actions.selection.copyPaths.name",
    categoryKey: "actions.selection.category",
    when: "selection.count > 0",
    handler: async () => {},
  },
];

const labels: Record<string, string> = {
  "actions.view.openCommandPalette.name": "Command Palette",
  "actions.view.category": "View",
  "actions.selection.copyPaths.name": "Copy Paths",
  "actions.selection.category": "Selection",
};

test("searchActions ranks prefix matches above fuzzy matches", () => {
  const results = searchActions(actions, "command", labels, () => true);
  assert.equal(results[0]?.action.id, "view.open-command-palette");
});

test("searchActions filters unavailable actions", () => {
  const results = searchActions(actions, "copy", labels, (action) =>
    action.id === "selection.copy-paths" ? false : true,
  );
  assert.equal(results.length, 0);
});
