import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import { useSpring, type SpringRef, type SpringValue } from "@react-spring/web";
import { createUseGesture, dragAction, pinchAction, wheelAction } from "@use-gesture/react";

import {
  dragExceededClickThreshold,
  panOffsetForPinch,
  panOffsetForZoomAtPoint,
} from "./slideshowPan";
import { ZOOM_MAX, ZOOM_MIN, wheelZoomScale } from "./slideshowZoom";

const useGesture = createUseGesture([dragAction, pinchAction, wheelAction]);

type PinchMemo = {
  pan: { x: number; y: number };
  scale: number;
  mid: { x: number; y: number };
  /** Untransformed layout center (parent), not the translated stage rect. */
  layoutCenter: { x: number; y: number };
};

function layoutCenterForStage(stage: HTMLElement): { x: number; y: number } {
  const layout = stage.parentElement?.getBoundingClientRect() ?? stage.getBoundingClientRect();
  return {
    x: layout.left + layout.width / 2,
    y: layout.top + layout.height / 2,
  };
}

export type SlideshowImageGestures = {
  x: SpringValue<number>;
  y: SpringValue<number>;
  scale: SpringValue<number>;
  api: SpringRef<{ x: number; y: number; scale: number }>;
  stageRef: RefCallback<HTMLDivElement>;
  isDragging: boolean;
  consumeSuppressClick: () => boolean;
  setTransform: (next: {
    x?: number;
    y?: number;
    scale?: number;
    immediate?: boolean;
  }) => void;
  getTransform: () => { x: number; y: number; scale: number };
};

/**
 * Image-stage drag / pinch / wheel via @use-gesture/react, rendered with
 * @react-spring/web (1:1 while gesturing, soft settle on release).
 */
export function useSlideshowImageGestures(options: {
  enabled: boolean;
  bumpActivity: () => void;
  revealZoomHudForScale: (scale: number) => void;
  onManualZoom: () => void;
}): SlideshowImageGestures {
  const { enabled, bumpActivity, revealZoomHudForScale, onManualZoom } = options;
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickRef = useRef(false);
  const [{ x, y, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    config: { tension: 280, friction: 30 },
  }));

  const getTransform = useCallback(
    () => ({ x: x.get(), y: y.get(), scale: scale.get() }),
    [x, y, scale],
  );

  const setTransform = useCallback(
    (next: { x?: number; y?: number; scale?: number; immediate?: boolean }) => {
      api.start({
        ...next,
        immediate: next.immediate ?? true,
      });
    },
    [api],
  );

  const consumeSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) {
      return false;
    }
    suppressClickRef.current = false;
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const prevent = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("gesturechange", prevent);
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
    };
  }, [enabled]);

  useGesture(
    {
      onDrag: ({
        pinching,
        down,
        offset: [ox, oy],
        movement: [mx, my],
        velocity: [vx, vy],
        direction: [dirX, dirY],
      }) => {
        if (pinching) {
          return;
        }
        bumpActivity();
        const safeOx = Number.isFinite(ox) ? ox : x.get();
        const safeOy = Number.isFinite(oy) ? oy : y.get();
        const posX = Number.isFinite(safeOx) ? safeOx : 0;
        const posY = Number.isFinite(safeOy) ? safeOy : 0;
        if (down && dragExceededClickThreshold(Math.hypot(mx || 0, my || 0))) {
          suppressClickRef.current = true;
        }
        setIsDragging(down);
        if (down) {
          api.start({
            x: posX,
            y: posY,
            immediate: true,
            config: { tension: 300, friction: 40 },
          });
          return;
        }
        // use-gesture velocity is absolute; restore sign via direction (or movement).
        const signedVx = (vx || 0) * (dirX || Math.sign(mx || 0) || 0);
        const signedVy = (vy || 0) * (dirY || Math.sign(my || 0) || 0);
        api.start({
          x: posX + signedVx * 80,
          y: posY + signedVy * 80,
          immediate: false,
          config: { tension: 170, friction: 28 },
        });
      },
      onPinch: ({ origin: [ox, oy], first, offset: [nextScale], memo, active }) => {
        bumpActivity();
        onManualZoom();
        let nextMemo = memo as PinchMemo | undefined;
        if (first || !nextMemo) {
          if (!stageEl) {
            return memo;
          }
          const layoutCenter = layoutCenterForStage(stageEl);
          nextMemo = {
            pan: { x: x.get(), y: y.get() },
            scale: scale.get(),
            mid: {
              x: ox - layoutCenter.x,
              y: oy - layoutCenter.y,
            },
            layoutCenter,
          };
        }
        if (!nextMemo) {
          return memo;
        }
        const { layoutCenter } = nextMemo;
        const nextPan = panOffsetForPinch(
          nextMemo.pan,
          nextMemo.mid,
          {
            x: ox - layoutCenter.x,
            y: oy - layoutCenter.y,
          },
          nextMemo.scale,
          nextScale,
        );
        api.start({
          scale: nextScale,
          x: nextPan.x,
          y: nextPan.y,
          immediate: active,
          config: { tension: 280, friction: 32 },
        });
        revealZoomHudForScale(nextScale);
        return nextMemo;
      },
      onWheel: ({ event }) => {
        event.preventDefault();
        bumpActivity();
        onManualZoom();
        const oldScale = scale.get();
        const newScale = wheelZoomScale(oldScale, event.deltaY);
        if (newScale === oldScale) {
          return;
        }
        const stage = stageEl;
        let nextPan = { x: x.get(), y: y.get() };
        if (stage) {
          const layoutCenter = layoutCenterForStage(stage);
          nextPan = panOffsetForZoomAtPoint(
            nextPan,
            {
              x: event.clientX - layoutCenter.x,
              y: event.clientY - layoutCenter.y,
            },
            oldScale,
            newScale,
          );
        }
        api.start({
          scale: newScale,
          x: nextPan.x,
          y: nextPan.y,
          immediate: true,
        });
        revealZoomHudForScale(newScale);
      },
    },
    {
      target: stageEl ?? undefined,
      enabled: enabled && stageEl != null,
      eventOptions: { passive: false },
      drag: {
        filterTaps: true,
        from: () => {
          const cx = x.get();
          const cy = y.get();
          return [Number.isFinite(cx) ? cx : 0, Number.isFinite(cy) ? cy : 0];
        },
        pointer: { touch: true },
      },
      pinch: {
        from: () => [scale.get(), 0],
        scaleBounds: { min: ZOOM_MIN, max: ZOOM_MAX },
        rubberband: true,
        pinchOnWheel: false,
      },
      wheel: {
        eventOptions: { passive: false },
      },
    },
  );

  return {
    x,
    y,
    scale,
    api,
    stageRef: setStageEl,
    isDragging,
    consumeSuppressClick,
    setTransform,
    getTransform,
  };
}
