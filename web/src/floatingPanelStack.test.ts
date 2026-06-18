import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bringFloatingPanelToFront,
  getFloatingPanelStackForTests,
  getFloatingPanelZIndex,
  isTopmostFloatingPanel,
  registerFloatingPanel,
  resetFloatingPanelStackForTests,
  unregisterFloatingPanel,
} from "./floatingPanelStack";

test("registerFloatingPanel appends new panels to the stack", () => {
  resetFloatingPanelStackForTests();
  registerFloatingPanel("info");
  registerFloatingPanel("upload");
  assert.deepEqual(getFloatingPanelStackForTests(), ["info", "upload"]);
  assert.equal(isTopmostFloatingPanel("upload"), true);
  assert.equal(isTopmostFloatingPanel("info"), false);
});

test("bringFloatingPanelToFront moves an existing panel to the top", () => {
  resetFloatingPanelStackForTests();
  registerFloatingPanel("info");
  registerFloatingPanel("upload");
  bringFloatingPanelToFront("info");
  assert.deepEqual(getFloatingPanelStackForTests(), ["upload", "info"]);
  assert.equal(isTopmostFloatingPanel("info"), true);
});

test("getFloatingPanelZIndex increases with stack position", () => {
  resetFloatingPanelStackForTests();
  registerFloatingPanel("info");
  registerFloatingPanel("upload");
  assert.equal(getFloatingPanelZIndex("info"), 50);
  assert.equal(getFloatingPanelZIndex("upload"), 51);
  bringFloatingPanelToFront("info");
  assert.equal(getFloatingPanelZIndex("info"), 51);
  assert.equal(getFloatingPanelZIndex("upload"), 50);
});

test("unregisterFloatingPanel removes a panel without affecting others", () => {
  resetFloatingPanelStackForTests();
  registerFloatingPanel("info");
  registerFloatingPanel("upload");
  unregisterFloatingPanel("info");
  assert.deepEqual(getFloatingPanelStackForTests(), ["upload"]);
  assert.equal(isTopmostFloatingPanel("upload"), true);
  assert.equal(getFloatingPanelZIndex("info"), 50);
});
