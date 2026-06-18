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
  "clipboard.count": 0,
  "preview.is-image": false,
  "preview.path": "",
  "viewer.preview-count": 0,
  "listing.show-dot-entries": false,
  "listing.loaded": true,
  "listing.visible-count": 0,
  "listing.view": "table",
  "slideshow.open": false,
  "preview.info-open": false,
};

const labelForKey = (key: string) =>
  ({
    "actions.whenFailure.selectionRequired": "Select one or more files",
    "actions.whenFailure.listingEmpty": "No items to select",
    "actions.whenFailure.unavailable": "Unavailable",
    "actions.custom.reason": "Custom reason",
  })[key] ?? key;

test("whenFailureMessageKey maps known when expressions", () => {
  assert.equal(
    whenFailureMessageKey("selection.count > 0"),
    "actions.whenFailure.selectionRequired",
  );
  assert.equal(
    whenFailureMessageKey("listing.visible-count > 0"),
    "actions.whenFailure.listingEmpty",
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

test("explainActionUnavailable reports first failed compound clause", () => {
  const action: ActionDefinition = {
    id: "selection.select-all",
    nameKey: "actions.selection.selectAll.name",
    categoryKey: "actions.selection.category",
    when:
      "focus.pane == 'file-list' && listing.loaded == true && listing.visible-count > 0",
    handler: async () => {},
  };
  assert.equal(
    explainActionUnavailable(action, emptySelection, labelForKey),
    "No items to select",
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
