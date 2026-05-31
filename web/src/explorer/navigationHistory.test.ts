import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createNavigationStacks,
  navigateBack,
  navigateForward,
  pushNavigationPath,
} from "./navigationHistory";

test("pushNavigationPath records current path and clears forward stack", () => {
  const stacks = { ...createNavigationStacks(), forward: ["old-forward"] };

  const next = pushNavigationPath(stacks, "a/b", "a/b/c");
  assert.deepEqual(next, { back: ["a/b"], forward: [] });
});

test("pushNavigationPath is a no-op for the same path", () => {
  const stacks = createNavigationStacks();
  assert.equal(pushNavigationPath(stacks, "a/b", "a/b"), null);
});

test("navigateBack and navigateForward move through history", () => {
  let stacks = createNavigationStacks();
  stacks = pushNavigationPath(stacks, "", "docs")!;
  stacks = pushNavigationPath(stacks, "docs", "docs/readme")!;

  const back = navigateBack(stacks, "docs/readme");
  assert.deepEqual(back, {
    path: "docs",
    stacks: { back: [""], forward: ["docs/readme"] },
  });

  const forward = navigateForward(back!.stacks, "docs");
  assert.deepEqual(forward, {
    path: "docs/readme",
    stacks: { back: ["", "docs"], forward: [] },
  });
});

test("navigateBack and navigateForward return null when unavailable", () => {
  const stacks = createNavigationStacks();
  assert.equal(navigateBack(stacks, ""), null);
  assert.equal(navigateForward(stacks, ""), null);
});
