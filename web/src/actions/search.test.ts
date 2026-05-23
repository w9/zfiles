import assert from "node:assert/strict";
import test from "node:test";

import { searchActions } from "./search";
import type { ActionDefinition } from "./types";

const actions: ActionDefinition[] = [
  {
    id: "navigation.focus-search",
    nameKey: "actions.navigation.focusSearch.name",
    categoryKey: "actions.navigation.category",
    aliasKeys: ["actions.navigation.focusSearch.alias"],
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
  "actions.navigation.focusSearch.name": "Focus Search",
  "actions.navigation.focusSearch.alias": "find",
  "actions.navigation.category": "Navigation",
  "actions.selection.copyPaths.name": "Copy Paths",
  "actions.selection.category": "Selection",
};

test("searchActions ranks prefix matches above fuzzy matches", () => {
  const results = searchActions(actions, "focus", labels, () => true);
  assert.equal(results[0]?.action.id, "navigation.focus-search");
});

test("searchActions filters unavailable actions", () => {
  const results = searchActions(actions, "copy", labels, (action) =>
    action.id === "selection.copy-paths" ? false : true,
  );
  assert.equal(results.length, 0);
});
