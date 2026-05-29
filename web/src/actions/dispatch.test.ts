import assert from "node:assert/strict";
import { test } from "node:test";

import { actionsForContext } from "./dispatch";
import type { ActionDefinition } from "./types";

const stubAction = (overrides: Partial<ActionDefinition>): ActionDefinition => ({
  id: "test.action",
  nameKey: "actions.view.openCommandPalette.name",
  handler: async () => {},
  ...overrides,
});

test("actionsForContext requires explicit contexts opt-in", () => {
  const context = { "focus.pane": "file-list" };
  const actions = [
    stubAction({ id: "a.no-contexts" }),
    stubAction({ id: "b.file-list", contexts: ["file-list"] }),
    stubAction({ id: "c.context-menu", contexts: ["context-menu"] }),
  ];

  assert.deepEqual(
    actionsForContext(actions, "context-menu", context).map((action) => action.id),
    ["c.context-menu"],
  );
  assert.deepEqual(
    actionsForContext(actions, "file-list", context).map((action) => action.id),
    ["b.file-list"],
  );
});

test("actionsForContext still applies when expressions", () => {
  const actions = [
    stubAction({
      id: "file.delete",
      contexts: ["context-menu"],
      when: "server.read-only == false",
    }),
  ];

  assert.equal(
    actionsForContext(actions, "context-menu", { "server.read-only": true }).length,
    0,
  );
  assert.equal(
    actionsForContext(actions, "context-menu", { "server.read-only": false }).length,
    1,
  );
});
