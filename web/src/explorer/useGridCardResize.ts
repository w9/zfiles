import { useCallback, useEffect, useRef } from "react";

import type { GridCardSize } from "@/settings/gridCardSize";

type UseGridCardResizeOptions = {
  cardSize: GridCardSize;
  onSizeChange: (size: GridCardSize) => void;
  onReset: () => void;
  onActiveChange?: (active: boolean) => void;
};

type ResizeSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startSize: GridCardSize;
};

export function useGridCardResize({
  cardSize,
  onSizeChange,
  onReset,
  onActiveChange,
}: UseGridCardResizeOptions) {
  const sessionRef = useRef<ResizeSession | null>(null);
  const cardSizeRef = useRef(cardSize);
  const onSizeChangeRef = useRef(onSizeChange);
  const onResetRef = useRef(onReset);
  const onActiveChangeRef = useRef(onActiveChange);

  cardSizeRef.current = cardSize;
  onSizeChangeRef.current = onSizeChange;
  onResetRef.current = onReset;
  onActiveChangeRef.current = onActiveChange;

  const finishSession = useCallback((target: HTMLElement | null, pointerId: number) => {
    if (target?.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    sessionRef.current = null;
    onActiveChangeRef.current?.(false);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      const deltaX = event.clientX - session.startX;
      const deltaY = event.clientY - session.startY;
      onSizeChangeRef.current({
        width: session.startSize.width + deltaX,
        height: session.startSize.height + deltaY,
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      finishSession(event.target instanceof HTMLElement ? event.target : null, event.pointerId);
    };

    const onPointerCancel = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      onSizeChangeRef.current(session.startSize);
      finishSession(event.target instanceof HTMLElement ? event.target : null, event.pointerId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [finishSession]);

  const onHandlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startSize: { ...cardSizeRef.current },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onActiveChangeRef.current?.(true);
  }, []);

  const onHandleDoubleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onResetRef.current();
  }, []);

  return {
    onHandlePointerDown,
    onHandleDoubleClick,
  };
}
