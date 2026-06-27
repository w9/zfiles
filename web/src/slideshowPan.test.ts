import assert from "node:assert/strict";
import test from "node:test";

import {
  DRAG_CLICK_THRESHOLD_PX,
  dragExceededClickThreshold,
  imageOverflowsViewport,
  panOffsetForZoomAtPoint,
  panOffsetFromDrag,
  pinchZoomScale,
  pointerDragDistance,
  showGrabCursor,
  touchPairDistance,
} from "./slideshowPan";

test("panOffsetFromDrag follows pointer delta", () => {
  assert.deepEqual(
    panOffsetFromDrag({ x: 10, y: -5 }, { x: 100, y: 200 }, { x: 130, y: 170 }),
    { x: 40, y: -35 },
  );
});

test("panOffsetForZoomAtPoint keeps cursor anchor when zooming", () => {
  assert.deepEqual(
    panOffsetForZoomAtPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, 2),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    panOffsetForZoomAtPoint({ x: 0, y: 0 }, { x: 100, y: -50 }, 1, 2),
    { x: -100, y: 50 },
  );
  assert.deepEqual(
    panOffsetForZoomAtPoint({ x: 20, y: 10 }, { x: 80, y: 40 }, 2, 1),
    { x: 60, y: 30 },
  );
  assert.deepEqual(
    panOffsetForZoomAtPoint({ x: 5, y: 5 }, { x: 10, y: 10 }, 1, 1),
    { x: 5, y: 5 },
  );
});

test("pointerDragDistance and click threshold", () => {
  assert.equal(pointerDragDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(dragExceededClickThreshold(DRAG_CLICK_THRESHOLD_PX), false);
  assert.equal(dragExceededClickThreshold(DRAG_CLICK_THRESHOLD_PX + 0.1), true);
});

test("imageOverflowsViewport detects overflow", () => {
  assert.equal(imageOverflowsViewport(1000, 800, 1, 900, 700), true);
  assert.equal(imageOverflowsViewport(400, 300, 1, 900, 700), false);
});

test("showGrabCursor when overflowed or panned", () => {
  assert.equal(showGrabCursor(false, { x: 0, y: 0 }), false);
  assert.equal(showGrabCursor(true, { x: 0, y: 0 }), true);
  assert.equal(showGrabCursor(false, { x: 1, y: 0 }), true);
});

test("touchPairDistance and pinchZoomScale", () => {
  assert.equal(
    touchPairDistance([
      { clientX: 0, clientY: 0 },
      { clientX: 3, clientY: 4 },
    ]),
    5,
  );
  assert.equal(pinchZoomScale(1, 100, 200), 2);
  assert.equal(pinchZoomScale(1, 0, 200), 1);
});
