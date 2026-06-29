import assert from "node:assert/strict";
import test from "node:test";

import { splitActionsForToolbarOverflow } from "./selectModeActionOverflow";

test("splitActionsForToolbarOverflow keeps all actions when they fit", () => {
  const actions = ["a", "b", "c"];
  const result = splitActionsForToolbarOverflow(actions, 300, {
    reservedLeadingPx: 46,
    reservedOverflowPx: 46,
    slotPx: 46,
  });
  assert.deepEqual(result, { visible: actions, overflow: [] });
});

test("splitActionsForToolbarOverflow moves trailing actions to overflow", () => {
  const actions = ["a", "b", "c", "d"];
  const result = splitActionsForToolbarOverflow(actions, 150, {
    reservedLeadingPx: 46,
    reservedOverflowPx: 46,
    slotPx: 46,
  });
  assert.deepEqual(result.visible.length + result.overflow.length, actions.length);
  assert.ok(result.overflow.length > 0);
  assert.deepEqual(result.visible, ["a"]);
  assert.deepEqual(result.overflow, ["b", "c", "d"]);
});

test("splitActionsForToolbarOverflow uses overflow menu when nothing else fits", () => {
  const actions = ["a", "b"];
  const result = splitActionsForToolbarOverflow(actions, 46, {
    reservedLeadingPx: 46,
    reservedOverflowPx: 46,
    slotPx: 46,
  });
  assert.deepEqual(result, { visible: [], overflow: actions });
});
