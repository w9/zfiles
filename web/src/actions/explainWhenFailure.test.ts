import assert from "node:assert/strict";
import test from "node:test";

import { explainActionUnavailable, whenFailureMessageKey } from "./explainWhenFailure";
import type { ActionDefinition } from "./types";
import type { ContextKeys } from "./contextKeys";

const emptySelection: ContextKeys = {
  "focus.pane": "file-list",
  "selection.count": 0,
  "selection.paths": [],
  "current-path": "",
  "connection.online": true,
  "server.read-only": false,
  "preview.is-image": false,
  "preview.path": "",
};

const labelForKey = (key: string) =>
  ({
    "actions.whenFailure.selectionRequired": "Select one or more files",
    "actions.whenFailure.unavailable": "Unavailable",
    "actions.custom.reason": "Custom reason",
  })[key] ?? key;

test("whenFailureMessageKey maps known when expressions", () => {
  assert.equal(
    whenFailureMessageKey("selection.count > 0"),
    "actions.whenFailure.selectionRequired",
  );
});

test("explainActionUnavailable returns null when action is available", () => {
  const action: ActionDefinition = {
    id: "selection.clear",
    nameKey: "actions.selection.clear.name",
    categoryKey: "actions.selection.category",
    when: "selection.count > 0",
    handler: async () => {},
  };
  assert.equal(
    explainActionUnavailable(
      action,
      { ...emptySelection, "selection.count": 2 },
      labelForKey,
    ),
    null,
  );
});

test("explainActionUnavailable uses mapped when failure message", () => {
  const action: ActionDefinition = {
    id: "selection.clear",
    nameKey: "actions.selection.clear.name",
    categoryKey: "actions.selection.category",
    when: "selection.count > 0",
    handler: async () => {},
  };
  assert.equal(
    explainActionUnavailable(action, emptySelection, labelForKey),
    "Select one or more files",
  );
});

test("explainActionUnavailable prefers custom whenFailureMessageKey", () => {
  const action: ActionDefinition = {
    id: "demo.action",
    nameKey: "demo",
    categoryKey: "actions.test.category",
    when: "selection.count > 0",
    whenFailureMessageKey: "actions.custom.reason",
    handler: async () => {},
  };
  assert.equal(
    explainActionUnavailable(action, emptySelection, labelForKey),
    "Custom reason",
  );
});
