import { useCallback, useEffect, useRef } from "react";

import { shouldIgnoreMarqueePointerTarget } from "@/explorer/listingMarqueeSelect";
import {
  isListingEntryPointerTarget,
  LISTING_LONG_PRESS_MS,
  LISTING_LONG_PRESS_MOVE_THRESHOLD_PX,
  shouldCancelLongPressOnMove,
  shouldHandleListingLongPress,
} from "@/explorer/listingLongPressContextMenu";

type LongPressSession = {
  pointerId: number;
  startX: number;
  startY: number;
  path: string | null;
};

export type UseListingLongPressSelectModeOptions = {
  enabled?: boolean;
  touchUi: boolean;
  onEnter: (path: string | null) => void;
};

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

export function useListingLongPressSelectMode({
  enabled = true,
  touchUi,
  onEnter,
}: UseListingLongPressSelectModeOptions) {
  const sessionRef = useRef<LongPressSession | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingClickSuppressRef = useRef<((event: MouseEvent) => void) | null>(null);
  const onEnterRef = useRef(onEnter);
  const touchUiRef = useRef(touchUi);
  const enabledRef = useRef(enabled);

  onEnterRef.current = onEnter;
  touchUiRef.current = touchUi;
  enabledRef.current = enabled;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearTimer();
    sessionRef.current = null;
  }, [clearTimer]);

  const enterAt = useCallback((path: string | null) => {
    suppressNextClick(pendingClickSuppressRef);
    onEnterRef.current(path);
  }, []);

  const scheduleLongPress = useCallback(
    (session: LongPressSession) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const active = sessionRef.current;
        if (!active || active.pointerId !== session.pointerId) {
          return;
        }
        sessionRef.current = null;
        enterAt(session.path);
      }, LISTING_LONG_PRESS_MS);
    },
    [clearTimer, enterAt],
  );

  const beginSession = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      path: string | null,
    ) => {
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

      const session: LongPressSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        path,
      };
      sessionRef.current = session;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const active = sessionRef.current;
        if (!active || moveEvent.pointerId !== active.pointerId) {
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
          clearSession();
        }
      };

      const onPointerEnd = (endEvent: PointerEvent) => {
        const active = sessionRef.current;
        if (!active || endEvent.pointerId !== active.pointerId) {
          return;
        }
        clearSession();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      scheduleLongPress(session);
    },
    [clearSession, scheduleLongPress],
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
      clearSession();
      if (pendingClickSuppressRef.current) {
        window.removeEventListener("click", pendingClickSuppressRef.current, true);
        pendingClickSuppressRef.current = null;
      }
    },
    [clearSession],
  );

  return {
    onEntryPointerDown,
    onViewportPointerDown,
  };
}
