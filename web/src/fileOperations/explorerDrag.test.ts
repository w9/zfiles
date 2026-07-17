import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canDropExplorerPaths,
  canStartExplorerEntryDrag,
  dragEventHasExplorerPaths,
  dragEventHasExternalFiles,
  EXPLORER_DRAG_HANDLE_ATTR,
  EXPLORER_DRAG_MIME,
  explorerDragOperationFromModifiers,
  parseExplorerDragPayload,
  resolveExplorerDragPaths,
  serializeExplorerDragPayload,
} from "./explorerDrag";

test("resolveExplorerDragPaths uses full selection when dragged path is selected", () => {
  assert.deepEqual(
    resolveExplorerDragPaths("a/b", new Set(["a/b", "a/c"])).sort(),
    ["a/b", "a/c"],
  );
});

test("resolveExplorerDragPaths uses only dragged path when it is not selected", () => {
  assert.deepEqual(resolveExplorerDragPaths("a/d", new Set(["a/b", "a/c"])), ["a/d"]);
});

test("resolveExplorerDragPaths uses dragged path when selection is empty", () => {
  assert.deepEqual(resolveExplorerDragPaths("a/b", new Set()), ["a/b"]);
});

test("explorerDragOperationFromModifiers defaults to cut (move)", () => {
  assert.equal(
    explorerDragOperationFromModifiers({ ctrlKey: false, altKey: false }),
    "cut",
  );
});

test("explorerDragOperationFromModifiers copies with ctrl or alt", () => {
  assert.equal(
    explorerDragOperationFromModifiers({ ctrlKey: true, altKey: false }),
    "copy",
  );
  assert.equal(
    explorerDragOperationFromModifiers({ ctrlKey: false, altKey: true }),
    "copy",
  );
});

test("canDropExplorerPaths rejects empty sources and into-own-descendant", () => {
  assert.equal(
    canDropExplorerPaths({ destDir: "a", sourcePaths: [], operation: "cut" }),
    false,
  );
  assert.equal(
    canDropExplorerPaths({
      destDir: "a/b",
      sourcePaths: ["a/b"],
      operation: "cut",
    }),
    false,
  );
  assert.equal(
    canDropExplorerPaths({
      destDir: "a/b/c",
      sourcePaths: ["a/b"],
      operation: "cut",
    }),
    false,
  );
});

test("canDropExplorerPaths rejects same-folder move but allows same-folder copy", () => {
  assert.equal(
    canDropExplorerPaths({
      destDir: "a",
      sourcePaths: ["a/x", "a/y"],
      operation: "cut",
    }),
    false,
  );
  assert.equal(
    canDropExplorerPaths({
      destDir: "a",
      sourcePaths: ["a/x", "a/y"],
      operation: "copy",
    }),
    true,
  );
});

test("canDropExplorerPaths allows move into a sibling folder", () => {
  assert.equal(
    canDropExplorerPaths({
      destDir: "a/dest",
      sourcePaths: ["a/x", "a/y"],
      operation: "cut",
    }),
    true,
  );
});

test("canDropExplorerPaths allows move into root from a subfolder", () => {
  assert.equal(
    canDropExplorerPaths({
      destDir: "",
      sourcePaths: ["a/x"],
      operation: "cut",
    }),
    true,
  );
});

test("serialize and parse explorer drag payload round-trip", () => {
  const raw = serializeExplorerDragPayload(["a/b", "a/c"]);
  assert.deepEqual(parseExplorerDragPayload(raw), { paths: ["a/b", "a/c"] });
  assert.equal(parseExplorerDragPayload("not-json"), null);
  assert.equal(parseExplorerDragPayload("{}"), null);
  assert.equal(parseExplorerDragPayload('{"paths":[]}'), null);
});

test("dragEventHasExplorerPaths and dragEventHasExternalFiles distinguish kinds", () => {
  assert.equal(dragEventHasExplorerPaths([EXPLORER_DRAG_MIME, "text/plain"]), true);
  assert.equal(dragEventHasExternalFiles([EXPLORER_DRAG_MIME, "Files"]), false);
  assert.equal(dragEventHasExternalFiles(["Files"]), true);
  assert.equal(dragEventHasExplorerPaths(["Files"]), false);
  assert.equal(dragEventHasExternalFiles(["text/plain"]), false);
});

test("canStartExplorerEntryDrag allows any target when selected", () => {
  assert.equal(
    canStartExplorerEntryDrag({ target: null, isSelected: true }),
    true,
  );
  const padding = { closest: () => null } as unknown as Element;
  assert.equal(
    canStartExplorerEntryDrag({ target: padding, isSelected: true }),
    true,
  );
});

test("canStartExplorerEntryDrag requires handle when unselected", () => {
  const handle = {
    closest: (selector: string) =>
      selector.includes(EXPLORER_DRAG_HANDLE_ATTR) ? handle : null,
  } as unknown as Element;
  const padding = { closest: () => null } as unknown as Element;
  assert.equal(
    canStartExplorerEntryDrag({ target: handle, isSelected: false }),
    true,
  );
  assert.equal(
    canStartExplorerEntryDrag({ target: padding, isSelected: false }),
    false,
  );
  assert.equal(
    canStartExplorerEntryDrag({ target: null, isSelected: false }),
    false,
  );
});
