import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UPLOAD_TRAY_DEFAULT_HEIGHT_PX,
  UPLOAD_TRAY_DEFAULT_WIDTH_PX,
  UPLOAD_TRAY_MIN_HEIGHT_PX,
  UPLOAD_TRAY_MIN_WIDTH_PX,
  applyResizeDelta,
  clampUploadTrayGeometry,
  defaultUploadTrayGeometry,
  parseStoredUploadTrayGeometry,
  type ResizeEdge,
  type UploadTrayGeometry,
} from "./uploadTrayGeometry";

const VIEWPORT = { width: 1200, height: 800 };

test("defaultUploadTrayGeometry opens above the anchor aligned to its end", () => {
  const anchor = { left: 900, right: 980, top: 800, bottom: 828, width: 80, height: 28 } as DOMRect;
  const geometry = defaultUploadTrayGeometry(anchor, VIEWPORT);
  assert.equal(geometry.width, UPLOAD_TRAY_DEFAULT_WIDTH_PX);
  assert.equal(geometry.height, UPLOAD_TRAY_DEFAULT_HEIGHT_PX);
  assert.equal(geometry.x, anchor.right - geometry.width);
  assert.equal(geometry.y, anchor.top - geometry.height - 8);
});

test("clampUploadTrayGeometry keeps the panel inside the viewport", () => {
  const clamped = clampUploadTrayGeometry(
    { x: -40, y: -20, width: 2000, height: 1200 },
    VIEWPORT,
  );
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
  assert.equal(clamped.width, VIEWPORT.width);
  assert.equal(clamped.height, VIEWPORT.height);
});

test("applyResizeDelta grows from the south-east corner", () => {
  const start: UploadTrayGeometry = { x: 100, y: 100, width: 400, height: 300 };
  const resized = applyResizeDelta(start, "se", 50, 40, {
    minWidth: UPLOAD_TRAY_MIN_WIDTH_PX,
    minHeight: UPLOAD_TRAY_MIN_HEIGHT_PX,
  });
  assert.deepEqual(resized, { x: 100, y: 100, width: 450, height: 340 });
});

test("applyResizeDelta moves the north edge and shrinks height", () => {
  const start: UploadTrayGeometry = { x: 100, y: 200, width: 400, height: 300 };
  const resized = applyResizeDelta(start, "n", 0, 50, {
    minWidth: UPLOAD_TRAY_MIN_WIDTH_PX,
    minHeight: UPLOAD_TRAY_MIN_HEIGHT_PX,
  });
  assert.deepEqual(resized, { x: 100, y: 250, width: 400, height: 250 });
});

test("applyResizeDelta enforces minimum size", () => {
  const start: UploadTrayGeometry = { x: 10, y: 10, width: 360, height: 260 };
  const edges: ResizeEdge[] = ["w", "n", "nw"];
  for (const edge of edges) {
    const resized = applyResizeDelta(start, edge, 500, 500, {
      minWidth: UPLOAD_TRAY_MIN_WIDTH_PX,
      minHeight: UPLOAD_TRAY_MIN_HEIGHT_PX,
    });
    assert.ok(resized.width >= UPLOAD_TRAY_MIN_WIDTH_PX);
    assert.ok(resized.height >= UPLOAD_TRAY_MIN_HEIGHT_PX);
  }
});

test("parseStoredUploadTrayGeometry accepts persisted numbers", () => {
  const parsed = parseStoredUploadTrayGeometry(
    JSON.stringify({ x: 12, y: 34, width: 500, height: 400 }),
  );
  assert.deepEqual(parsed, { x: 12, y: 34, width: 500, height: 400 });
});

test("parseStoredUploadTrayGeometry rejects invalid payloads", () => {
  assert.equal(parseStoredUploadTrayGeometry(null), null);
  assert.equal(parseStoredUploadTrayGeometry("{}"), null);
  assert.equal(parseStoredUploadTrayGeometry('{"x":1,"y":2}'), null);
});
