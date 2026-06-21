import { useCallback, useEffect, useRef } from "react";

import { shouldIgnoreMarqueePointerTarget } from "@/explorer/listingMarqueeSelect";
import {
  isListingEntryPointerTarget,
  LISTING_LONG_PRESS_MS,
  LISTING_LONG_PRESS_MOVE_THRESHOLD_PX,
  shouldCancelLongPressOnMove,
  shouldHandleListingLongPress,
  type ContextMenuPointerEvent,
} from "@/explorer/listingLongPressContextMenu";

type LongPressSession = {
  pointerId: number;
  startX: number;
  startY: number;
  path: string | null;
};

export type UseListingLongPressContextMenuOptions = {
  enabled?: boolean;
  touchUi: boolean;
  onOpen: (event: ContextMenuPointerEvent, path: string | null) => void;
};

function suppressNextClick(
  pendingListenerRef: React.MutableRefObject<((event: MouseEvent) => void) | null>,
) {
  if (pendingListenerRef.current) {
    window.removeEventListener("click", pendingListenerRef.current, true);
  }

  const suppressClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("click", suppressClick, true);
    pendingListenerRef.current = null;
  };

  pendingListenerRef.current = suppressClick;
  window.addEventListener("click", suppressClick, true);
}

export function useListingLongPressContextMenu({
  enabled = true,
  touchUi,
  onOpen,
}: UseListingLongPressContextMenuOptions) {
  const sessionRef = useRef<LongPressSession | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingClickSuppressRef = useRef<((event: MouseEvent) => void) | null>(null);
  const onOpenRef = useRef(onOpen);
  const touchUiRef = useRef(touchUi);
  const enabledRef = useRef(enabled);

  onOpenRef.current = onOpen;
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

  const openAt = useCallback(
    (clientX: number, clientY: number, path: string | null) => {
      suppressNextClick(pendingClickSuppressRef);
      onOpenRef.current(
        {
          clientX,
          clientY,
          preventDefault: () => {},
        },
        path,
      );
    },
    [],
  );

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
        openAt(session.startX, session.startY, session.path);
      }, LISTING_LONG_PRESS_MS);
    },
    [clearTimer, openAt],
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
