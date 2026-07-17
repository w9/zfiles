import assert from "node:assert/strict";
import test from "node:test";

import { dragEventHasExternalFiles, EXPLORER_DRAG_MIME } from "./fileOperations/explorerDrag";
import { canCaptureDropFileHandles, dragEventHasFiles } from "./useGlobalFileDrop";

test("dragEventHasFiles detects Files type", () => {
  const withFiles = {
    dataTransfer: { types: ["Files"] },
  } as DragEvent;
  const withoutFiles = {
    dataTransfer: { types: ["text/plain"] },
  } as DragEvent;
  const missingTransfer = {} as DragEvent;

  assert.equal(dragEventHasFiles(withFiles), true);
  assert.equal(dragEventHasFiles(withoutFiles), false);
  assert.equal(dragEventHasFiles(missingTransfer), false);
});

test("upload drop ignores explorer-internal drags even if Files is listed", () => {
  assert.equal(dragEventHasExternalFiles(["Files"]), true);
  assert.equal(dragEventHasExternalFiles([EXPLORER_DRAG_MIME, "Files"]), false);
});

test("canCaptureDropFileHandles is false without a secure browser context", () => {
  assert.equal(canCaptureDropFileHandles(), false);
});
