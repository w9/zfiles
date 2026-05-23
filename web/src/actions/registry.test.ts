import assert from "node:assert/strict";
import test from "node:test";

import { ActionRegistry } from "./registry";
import { evaluateWhen } from "./when";
import { defaultContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";

function action(id: string, when?: string): ActionDefinition {
  return {
    id,
    nameKey: "actions.test.name",
    categoryKey: "actions.test.category",
    when,
    handler: async () => {},
  };
}

test("registry registers and lists actions", () => {
  const registry = new ActionRegistry();
  registry.register(action("a.one"));
  registry.register(action("a.two"));
  assert.equal(registry.list().length, 2);
  assert.equal(registry.get("a.one")?.id, "a.one");
});

test("availableActions filters by when expression", () => {
  const registry = new ActionRegistry();
  registry.register(action("enabled", "selection.count > 0"));
  registry.register(action("disabled", "selection.count > 5"));
  const context = { ...defaultContextKeys(), "selection.count": 2 };
  const available = registry
    .list()
    .filter((item) => evaluateWhen(item.when, context));
  assert.deepEqual(
    available.map((item) => item.id),
    ["enabled"],
  );
});
