import { useCallback, useEffect, useRef, type RefObject } from "react";

import {
  MARQUEE_AUTO_SCROLL_MARGIN_PX,
  MARQUEE_AUTO_SCROLL_STEP_PX,
  collectDomEntryRectsFromViewport,
  findEntryPathAtPoint,
  shouldIgnoreMarqueePointerTarget,
  type ListingMarqueeLayoutResolver,
} from "@/explorer/listingMarqueeSelect";
import {
  isListingEntryPointerTarget,
  LISTING_LONG_PRESS_MS,
  LISTING_LONG_PRESS_MOVE_THRESHOLD_PX,
  shouldCancelLongPressOnMove,
  shouldHandleListingLongPress,
} from "@/explorer/listingLongPressContextMenu";

export type UseListingLongPressRangeSelectOptions = {
  enabled?: boolean;
  touchUi: boolean;
  scrollElementRef: RefObject<HTMLElement | null>;
  layoutRef?: RefObject<ListingMarqueeLayoutResolver | null>;
  /** Long-press fired. Return true to arm drag-to-range-select for the rest of the gesture. */
  onLongPress: (path: string | null) => boolean;
  /** Finger down on a listing row; highlight the pressed item. */
  onPressStart?: (path: string | null) => void;
  /** Armed drag is over a row (or none); extend the range toward it. */
  onSwipeExtend: (targetPath: string | null) => void;
  /** Touch press gesture ended (pointer up/cancel). */
  onGestureEnd?: () => void;
};

type GestureSession = {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  path: string | null;
  armed: boolean;
};

function resolvePathAtPoint(
  scrollElement: HTMLElement,
  layoutRef: RefObject<ListingMarqueeLayoutResolver | null> | undefined,
  clientX: number,
  clientY: number,
): string | null {
  const layout = layoutRef?.current;
  if (layout) {
    return layout.findPathAtClientPoint(scrollElement, clientX, clientY);
  }
  const entryRects = collectDomEntryRectsFromViewport(scrollElement);
  return findEntryPathAtPoint(entryRects, clientX, clientY);
}

function suppressNextClick(
  pendingListenerRef: React.MutableRefObject<((event: MouseEvent) => void) | null>,
) {
  if (pendingListenerRef.current) {
    window.removeEventListener("click", pendingListenerRef.current, true);
  }

  const suppressClick = (event: MouseEvent) => {
    window.removeEventListener("click", suppressClick, true);
    pendingListenerRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  pendingListenerRef.current = suppressClick;
  window.addEventListener("click", suppressClick, true);
}

/** How long to keep the post-long-press click suppressor after pointerup. */
const CLICK_SUPPRESS_EXPIRE_MS = 50;

function clearPendingClickSuppress(
  pendingListenerRef: React.MutableRefObject<((event: MouseEvent) => void) | null>,
) {
  if (!pendingListenerRef.current) {
    return;
  }
  window.removeEventListener("click", pendingListenerRef.current, true);
  pendingListenerRef.current = null;
}

/**
 * After an armed long-press ends, a trailing click may still fire (no-drag
 * release). Keep the suppressor briefly for that click, then drop it so the
 * next intentional tap is not eaten when no release click arrives (drag case).
 */
function expirePendingClickSuppressSoon(
  pendingListenerRef: React.MutableRefObject<((event: MouseEvent) => void) | null>,
) {
  const listener = pendingListenerRef.current;
  if (!listener) {
    return;
  }
  window.setTimeout(() => {
    if (pendingListenerRef.current !== listener) {
      return;
    }
    clearPendingClickSuppress(pendingListenerRef);
  }, CLICK_SUPPRESS_EXPIRE_MS);
}

export function useListingLongPressRangeSelect({
  enabled = true,
  touchUi,
  scrollElementRef,
  layoutRef,
  onLongPress,
  onPressStart,
  onSwipeExtend,
  onGestureEnd,
}: UseListingLongPressRangeSelectOptions) {
  const sessionRef = useRef<GestureSession | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingClickSuppressRef = useRef<((event: MouseEvent) => void) | null>(null);
  const touchMoveBlockerRef = useRef<((event: TouchEvent) => void) | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const onLongPressRef = useRef(onLongPress);
  const onPressStartRef = useRef(onPressStart);
  const onSwipeExtendRef = useRef(onSwipeExtend);
  const onGestureEndRef = useRef(onGestureEnd);
  const touchUiRef = useRef(touchUi);
  const enabledRef = useRef(enabled);

  onLongPressRef.current = onLongPress;
  onPressStartRef.current = onPressStart;
  onSwipeExtendRef.current = onSwipeExtend;
  onGestureEndRef.current = onGestureEnd;
  touchUiRef.current = touchUi;
  enabledRef.current = enabled;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current != null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  // Native pan cannot be re-enabled mid-gesture via touch-action, so once the
  // long-press arms we block touchmove for the remainder of the touch.
  const blockNativeScroll = useCallback(() => {
    if (touchMoveBlockerRef.current) {
      return;
    }
    const block = (event: TouchEvent) => {
      event.preventDefault();
    };
    touchMoveBlockerRef.current = block;
    window.addEventListener("touchmove", block, { passive: false });
  }, []);

  const unblockNativeScroll = useCallback(() => {
    if (touchMoveBlockerRef.current) {
      window.removeEventListener("touchmove", touchMoveBlockerRef.current);
      touchMoveBlockerRef.current = null;
    }
  }, []);

  const extendAt = useCallback(
    (clientX: number, clientY: number) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }
      const targetPath = resolvePathAtPoint(scrollElement, layoutRef, clientX, clientY);
      onSwipeExtendRef.current(targetPath);
    },
    [layoutRef, scrollElementRef],
  );

  const startAutoScroll = useCallback(() => {
    const scrollElement = scrollElementRef.current;
    const session = sessionRef.current;
    if (!scrollElement || !session?.armed) {
      stopAutoScroll();
      return;
    }

    const bounds = scrollElement.getBoundingClientRect();
    let delta = 0;
    if (session.clientY < bounds.top + MARQUEE_AUTO_SCROLL_MARGIN_PX) {
      delta = -MARQUEE_AUTO_SCROLL_STEP_PX;
    } else if (session.clientY > bounds.bottom - MARQUEE_AUTO_SCROLL_MARGIN_PX) {
      delta = MARQUEE_AUTO_SCROLL_STEP_PX;
    }

    if (delta !== 0) {
      scrollElement.scrollTop += delta;
      extendAt(session.clientX, session.clientY);
    }

    autoScrollFrameRef.current = requestAnimationFrame(startAutoScroll);
  }, [extendAt, scrollElementRef, stopAutoScroll]);

  const endSession = useCallback(() => {
    clearTimer();
    stopAutoScroll();
    unblockNativeScroll();
    sessionRef.current = null;
  }, [clearTimer, stopAutoScroll, unblockNativeScroll]);

  const scheduleLongPress = useCallback(
    (session: GestureSession) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const active = sessionRef.current;
        if (!active || active.pointerId !== session.pointerId) {
          return;
        }
        // The release click after a long-press must not toggle the entry again.
        suppressNextClick(pendingClickSuppressRef);
        active.armed = onLongPressRef.current(active.path);
        if (!active.armed) {
          sessionRef.current = null;
          return;
        }
        blockNativeScroll();
        const scrollElement = scrollElementRef.current;
        if (scrollElement?.setPointerCapture) {
          try {
            scrollElement.setPointerCapture(active.pointerId);
          } catch {
            // Pointer may already be gone; drag tracking still works via window listeners.
          }
        }
      }, LISTING_LONG_PRESS_MS);
    },
    [blockNativeScroll, clearTimer, scrollElementRef],
  );

  const beginSession = useCallback(
    (event: React.PointerEvent<HTMLElement>, path: string | null) => {
      if (
        !shouldHandleListingLongPress({
          enabled: enabledRef.current,
          touchUi: touchUiRef.current,
          pointerType: event.pointerType,
        })
      ) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (shouldIgnoreMarqueePointerTarget(event.target)) {
        return;
      }

      const pointerId = event.pointerId;
      const session: GestureSession = {
        pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        path,
        armed: false,
      };
      sessionRef.current = session;
      onPressStartRef.current?.(path);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const active = sessionRef.current;
        if (!active || moveEvent.pointerId !== active.pointerId) {
          return;
        }
        if (active.armed) {
          active.clientX = moveEvent.clientX;
          active.clientY = moveEvent.clientY;
          extendAt(moveEvent.clientX, moveEvent.clientY);
          stopAutoScroll();
          startAutoScroll();
          return;
        }
        if (
          shouldCancelLongPressOnMove({
            startX: active.startX,
            startY: active.startY,
            clientX: moveEvent.clientX,
            clientY: moveEvent.clientY,
            thresholdPx: LISTING_LONG_PRESS_MOVE_THRESHOLD_PX,
          })
        ) {
          clearTimer();
        }
      };

      const onPointerEnd = (endEvent: PointerEvent) => {
        if (endEvent.pointerId !== pointerId) {
          return;
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
        const active = sessionRef.current;
        if (active && active.pointerId === pointerId) {
          if (active.armed) {
            extendAt(endEvent.clientX, endEvent.clientY);
            const scrollElement = scrollElementRef.current;
            if (scrollElement?.hasPointerCapture?.(active.pointerId)) {
              scrollElement.releasePointerCapture(active.pointerId);
            }
            expirePendingClickSuppressSoon(pendingClickSuppressRef);
          }
          endSession();
          onGestureEndRef.current?.();
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      scheduleLongPress(session);
    },
    [clearTimer, endSession, extendAt, scheduleLongPress, scrollElementRef, startAutoScroll, stopAutoScroll],
  );

  const onEntryPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, path: string) => {
      beginSession(event, path);
    },
    [beginSession],
  );

  const onViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isListingEntryPointerTarget(event.target)) {
        return;
      }
      beginSession(event, null);
    },
    [beginSession],
  );

  useEffect(
    () => () => {
      endSession();
      if (pendingClickSuppressRef.current) {
        clearPendingClickSuppress(pendingClickSuppressRef);
      }
    },
    [endSession],
  );

  return {
    onEntryPointerDown,
    onViewportPointerDown,
  };
}
