import assert from "node:assert/strict";
import test from "node:test";

import { actionsForContext } from "./dispatch";
import { pluginActionToDefinition } from "./builtins";
import { MENU_CONTEXT } from "./surfaces";
import type { ContextKeys } from "./contextKeys";

const contextKeys: ContextKeys = {
  "focus.pane": "file-list",
  "selection.count": 1,
  "selection.paths": ["notes.txt"],
  "current-path": "",
  "searcher.ready": true,
  "connection.online": true,
};

test("pluginActionToDefinition registers menubar-eligible plugin action", () => {
  const action = pluginActionToDefinition(
    {
      id: "copy-path",
      name: "Copy path",
      contexts: ["file-list", "menubar"],
      category: "actions.plugin.category",
    },
    async () => {},
  );
  assert.equal(action.categoryKey, "actions.plugin.category");
  const visible = actionsForContext([action], MENU_CONTEXT, contextKeys);
  assert.equal(visible.length, 1);
});

test("pluginActionToDefinition hides from menubar without menubar context", () => {
  const action = pluginActionToDefinition(
    {
      id: "copy-path",
      name: "Copy path",
      contexts: ["file-list"],
      category: "actions.plugin.category",
    },
    async () => {},
  );
  const visible = actionsForContext([action], MENU_CONTEXT, contextKeys);
  assert.equal(visible.length, 0);
});

test("pluginActionToDefinition preserves manifest category and default keybinding", () => {
  const action = pluginActionToDefinition(
    {
      id: "copy-path",
      name: "Copy path",
      category: "actions.selection.category",
      defaultKeybinding: "Mod+Shift+C",
    },
    async () => {},
  );
  assert.equal(action.categoryKey, "actions.selection.category");
  assert.equal(action.defaultKeybinding, "Mod+Shift+C");
});
