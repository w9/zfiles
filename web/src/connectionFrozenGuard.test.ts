import assert from "node:assert/strict";
import test from "node:test";

import {
  isActionAllowedWhileFrozen,
  isActionBlockedByFrozenConnection,
} from "./connectionFrozenGuard";

test("storage actions are blocked while frozen", () => {
  for (const id of [
    "file.delete",
    "file.rename",
    "file.new-folder",
    "file.upload-choose-files",
    "selection.download",
    "viewer.preview",
    "preview.get-info",
  ]) {
    assert.equal(isActionBlockedByFrozenConnection(true, id), true, id);
  }
});

test("navigation to unseen data is blocked while frozen", () => {
  for (const id of [
    "navigation.back",
    "navigation.forward",
    "navigation.up",
    "navigation.open",
    "navigation.refresh",
    "navigation.go-to-path",
  ]) {
    assert.equal(isActionBlockedByFrozenConnection(true, id), true, id);
  }
});

test("connection, appearance, and local view actions stay available while frozen", () => {
  for (const id of [
    "connection.switch",
    "connection.create",
    "connection.share-url",
    "appearance.cycle-theme",
    "appearance.set-locale",
    "view.open-command-palette",
    "view.toggle-listing-mode",
    "help.open-keyboard-shortcuts",
    "navigation.open-settings",
    "navigation.focus-quick-filter",
    "selection.move-down",
    "selection.copy-paths",
  ]) {
    assert.equal(isActionAllowedWhileFrozen(id), true, id);
    assert.equal(isActionBlockedByFrozenConnection(true, id), false, id);
  }
});

test("nothing is blocked when the connection is healthy", () => {
  assert.equal(isActionBlockedByFrozenConnection(false, "file.delete"), false);
  assert.equal(isActionBlockedByFrozenConnection(false, "navigation.refresh"), false);
});
