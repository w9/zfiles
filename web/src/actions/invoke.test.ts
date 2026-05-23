import assert from "node:assert/strict";
import test from "node:test";

import { ActionRegistry } from "./registry";
import { defaultContextKeys } from "./contextKeys";
import { invokeAction } from "./invoke";
import type { ActionDefinition } from "./types";

function action(overrides: Partial<ActionDefinition>): ActionDefinition {
  return {
    id: "test.action",
    nameKey: "actions.test.name",
    categoryKey: "actions.test.category",
    handler: async () => {},
    ...overrides,
  };
}

test("invokeAction skips destructive confirm when args.confirm is false", async () => {
  const registry = new ActionRegistry();
  let called = false;
  registry.register(
    action({
      id: "selection.clear",
      destructive: true,
      handler: async () => {
        called = true;
      },
    }),
  );
  const context = { ...defaultContextKeys(), "selection.count": 1 };
  const result = await invokeAction(
    registry,
    context,
    "selection.clear",
    { args: { confirm: false } },
    {
      confirmDestructive: async () => false,
    },
  );
  assert.equal(result.ok, true);
  assert.equal(called, true);
});

test("invokeAction prompts for missing args", async () => {
  const registry = new ActionRegistry();
  let receivedPath = "";
  registry.register(
    action({
      id: "navigation.go-to-path",
      args: [{ name: "path", type: "string" }],
      handler: async (_context, args) => {
        receivedPath = String(args?.path ?? "");
      },
    }),
  );
  const result = await invokeAction(
    registry,
    defaultContextKeys(),
    "navigation.go-to-path",
    {},
    {
      promptArg: async () => "docs/guides",
    },
  );
  assert.equal(result.ok, true);
  assert.equal(receivedPath, "docs/guides");
});
