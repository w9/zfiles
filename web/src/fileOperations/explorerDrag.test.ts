import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canDropExplorerPaths,
  canStartExplorerEntryDrag,
  destDirFromExplorerDropId,
  EXPLORER_DRAG_HANDLE_ATTR,
  explorerDragOperationFromModifiers,
  explorerDropIdForDir,
  formatExplorerDragOverlayText,
  middleEllipsizeName,
  resolveExplorerDragPaths,
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

test("explorerDragOperationFromModifiers defaults to cut (move)", () => {
  assert.equal(
    explorerDragOperationFromModifiers({
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    }),
    "cut",
  );
});

test("explorerDragOperationFromModifiers copies with ctrl, alt, or meta", () => {
  assert.equal(
    explorerDragOperationFromModifiers({
      ctrlKey: true,
      altKey: false,
      metaKey: false,
    }),
    "copy",
  );
  assert.equal(
    explorerDragOperationFromModifiers({
      ctrlKey: false,
      altKey: true,
      metaKey: false,
    }),
    "copy",
  );
  assert.equal(
    explorerDragOperationFromModifiers({
      ctrlKey: false,
      altKey: false,
      metaKey: true,
    }),
    "copy",
  );
});

test("canDropExplorerPaths rejects into-own-descendant and same-folder move", () => {
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
      destDir: "a",
      sourcePaths: ["a/x"],
      operation: "cut",
    }),
    false,
  );
  assert.equal(
    canDropExplorerPaths({
      destDir: "a/dest",
      sourcePaths: ["a/x"],
      operation: "cut",
    }),
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
    canStartExplorerEntryDrag({ target: padding, isSelected: true }),
    true,
  );
});

test("explorer drop ids round-trip including root", () => {
  assert.equal(destDirFromExplorerDropId(explorerDropIdForDir("")), "");
  assert.equal(destDirFromExplorerDropId(explorerDropIdForDir("a/b")), "a/b");
  assert.equal(destDirFromExplorerDropId("other"), null);
});

test("middleEllipsizeName keeps short names and middle-ellipsizes long ones", () => {
  assert.equal(middleEllipsizeName("short.txt"), "short.txt");
  assert.equal(
    middleEllipsizeName("abcdefghijklmnopqrstuvwxyz0123456789.txt"),
    "abcdefghijklmn…0123456789.txt",
  );
});

test("formatExplorerDragOverlayText summarizes action and items", () => {
  const t = (key: string, params?: Record<string, string>) => {
    if (key === "explorer.drag.overlay.move") return "Move";
    if (key === "explorer.drag.overlay.copy") return "Copy";
    if (key === "explorer.drag.overlay.badge") {
      return `${params?.action} · ${params?.label}`;
    }
    if (key === "explorer.drag.overlay.folders") return `${params?.count} folders`;
    if (key === "explorer.drag.overlay.breakdown") {
      return `${params?.files}, ${params?.folders}`;
    }
    if (key === "selection.fileUnit.one") return "1 file";
    if (key === "selection.fileUnit.many") return `${params?.count} files`;
    if (key === "selection.folderUnit.one") return "1 folder";
    if (key === "selection.folderUnit.many") return `${params?.count} folders`;
    return key;
  };

  assert.equal(
    formatExplorerDragOverlayText({
      paths: ["docs/a.txt"],
      operation: "cut",
      counts: { fileCount: 1, folderCount: 0 },
      t,
    }),
    "Move · a.txt",
  );
  assert.equal(
    formatExplorerDragOverlayText({
      paths: ["a", "b", "c"],
      operation: "copy",
      counts: { fileCount: 2, folderCount: 1 },
      t,
    }),
    "Copy · 2 files, 1 folder",
  );
  assert.equal(
    formatExplorerDragOverlayText({
      paths: ["a.txt", "b.txt", "c.txt"],
      operation: "cut",
      counts: { fileCount: 3, folderCount: 0 },
      t,
    }),
    "Move · 3 files",
  );
  assert.equal(
    formatExplorerDragOverlayText({
      paths: ["dir/abcdefghijklmnopqrstuvwxyz0123456789.txt"],
      operation: "copy",
      counts: { fileCount: 1, folderCount: 0 },
      t,
    }),
    "Copy · abcdefghijklmn…0123456789.txt",
  );
});
