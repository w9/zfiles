import assert from "node:assert/strict";
import test from "node:test";

import {
  DRAG_CLICK_THRESHOLD_PX,
  dragExceededClickThreshold,
  imageOverflowsViewport,
  panOffsetForPinch,
  panOffsetForZoomAtPoint,
  panOffsetFromDrag,
  pinchZoomScale,
  pointerDragDistance,
  showGrabCursor,
  touchPairDistance,
  touchPairMidpoint,
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

test("touchPairMidpoint averages the first two touches", () => {
  assert.deepEqual(
    touchPairMidpoint([
      { clientX: 0, clientY: 10 },
      { clientX: 40, clientY: 50 },
    ]),
    { x: 20, y: 30 },
  );
  assert.equal(touchPairMidpoint([{ clientX: 0, clientY: 0 }]), null);
});

test("panOffsetForPinch zooms around midpoint and follows midpoint motion", () => {
  // Zoom 1→2 at offset (100,0) with no midpoint motion: same as zoom-at-point.
  assert.deepEqual(
    panOffsetForPinch({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, 1, 2),
    { x: -100, y: 0 },
  );
  // Same zoom, midpoint also moves by (+30, -10): add that translation.
  assert.deepEqual(
    panOffsetForPinch({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 130, y: -10 }, 1, 2),
    { x: -70, y: -10 },
  );
  // Pure pan (scale unchanged): only midpoint delta applies.
  assert.deepEqual(
    panOffsetForPinch({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 20, y: -15 }, 1, 1),
    { x: 25, y: -10 },
  );
});
