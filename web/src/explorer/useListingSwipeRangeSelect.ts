import { useCallback, useEffect, useRef, type RefObject } from "react";

import {
  MARQUEE_AUTO_SCROLL_MARGIN_PX,
  MARQUEE_AUTO_SCROLL_STEP_PX,
  MARQUEE_DRAG_THRESHOLD_PX,
  collectDomEntryRectsFromViewport,
  findEntryPathAtPoint,
  pointerDistance,
  shouldIgnoreMarqueePointerTarget,
  type ListingMarqueeLayoutResolver,
} from "@/explorer/listingMarqueeSelect";
import {
  entryIndexForPath,
  shouldHandleSwipeRangeSelect,
  swipeRangeFromAnchor,
} from "@/explorer/listingSwipeRangeSelect";

export type UseListingSwipeRangeSelectOptions = {
  selectionMode: boolean;
  enabled?: boolean;
  entries: ReadonlyArray<{ path: string }>;
  scrollElementRef: RefObject<HTMLElement | null>;
  layoutRef?: RefObject<ListingMarqueeLayoutResolver | null>;
  onSelectionChange: (paths: Set<string>, primaryPath: string | null) => void;
};

type SwipeSession = {
  pointerId: number;
  anchorIndex: number;
  anchorPath: string;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  started: boolean;
};

function collectEntryRectsFromViewport(
  scrollElement: HTMLElement,
  layoutRef?: RefObject<ListingMarqueeLayoutResolver | null>,
) {
  const layout = layoutRef?.current;
  if (layout) {
    return layout.getEntryRects(scrollElement);
  }
  return collectDomEntryRectsFromViewport(scrollElement);
}

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
  const entryRects = collectEntryRectsFromViewport(scrollElement, layoutRef);
  return findEntryPathAtPoint(entryRects, clientX, clientY);
}

function suppressSwipeEndClick(
  pendingListenerRef: React.MutableRefObject<((event: MouseEvent) => void) | null>,
) {
  if (pendingListenerRef.current) {
    window.removeEventListener("click", pendingListenerRef.current, true);
  }

  const suppressNextClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("click", suppressNextClick, true);
    pendingListenerRef.current = null;
  };

  pendingListenerRef.current = suppressNextClick;
  window.addEventListener("click", suppressNextClick, true);
}

export function useListingSwipeRangeSelect({
  selectionMode,
  enabled = true,
  entries,
  scrollElementRef,
  layoutRef,
  onSelectionChange,
}: UseListingSwipeRangeSelectOptions) {
  const sessionRef = useRef<SwipeSession | null>(null);
  const pendingClickSuppressRef = useRef<((event: MouseEvent) => void) | null>(
    null,
  );
  const autoScrollFrameRef = useRef<number | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const entriesRef = useRef(entries);
  const selectionModeRef = useRef(selectionMode);

  onSelectionChangeRef.current = onSelectionChange;
  entriesRef.current = entries;
  selectionModeRef.current = selectionMode;

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current != null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const applySwipeAt = useCallback(
    (clientX: number, clientY: number, session: SwipeSession) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }

      const targetPath = resolvePathAtPoint(
        scrollElement,
        layoutRef,
        clientX,
        clientY,
      );
      const nextSelection = swipeRangeFromAnchor(
        entriesRef.current,
        session.anchorIndex,
        targetPath,
      );
      const primaryPath =
        targetPath && nextSelection.has(targetPath)
          ? targetPath
          : session.anchorPath;
      onSelectionChangeRef.current(nextSelection, primaryPath);
    },
    [layoutRef, scrollElementRef],
  );

  const startAutoScroll = useCallback(() => {
    const scrollElement = scrollElementRef.current;
    const session = sessionRef.current;
    if (!scrollElement || !session?.started) {
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
      applySwipeAt(session.clientX, session.clientY, session);
    }

    autoScrollFrameRef.current = requestAnimationFrame(startAutoScroll);
  }, [applySwipeAt, scrollElementRef, stopAutoScroll]);

  const endSession = useCallback(
    (session: SwipeSession | null, didSwipe: boolean) => {
      sessionRef.current = null;
      stopAutoScroll();
      if (didSwipe) {
        suppressSwipeEndClick(pendingClickSuppressRef);
      }
    },
    [stopAutoScroll],
  );

  useEffect(
    () => () => {
      stopAutoScroll();
      if (pendingClickSuppressRef.current) {
        window.removeEventListener(
          "click",
          pendingClickSuppressRef.current,
          true,
        );
        pendingClickSuppressRef.current = null;
      }
    },
    [stopAutoScroll],
  );

  const onViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      if (!enabled || !selectionModeRef.current) {
        return;
      }
      if (shouldIgnoreMarqueePointerTarget(event.target)) {
        return;
      }
      if (
        !shouldHandleSwipeRangeSelect({
          selectionMode: selectionModeRef.current,
          pointerType: event.pointerType,
          target: event.target,
        })
      ) {
        return;
      }

      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const entry = target.closest("[data-listing-entry]");
      const anchorPath = entry?.getAttribute("data-listing-path");
      if (!anchorPath) {
        return;
      }
      const anchorIndex = entryIndexForPath(entriesRef.current, anchorPath);
      if (anchorIndex < 0) {
        return;
      }

      const session: SwipeSession = {
        pointerId: event.pointerId,
        anchorIndex,
        anchorPath,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        started: false,
      };
      sessionRef.current = session;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const active = sessionRef.current;
        if (!active || moveEvent.pointerId !== active.pointerId) {
          return;
        }

        if (!active.started) {
          const distance = pointerDistance(
            active.startX,
            active.startY,
            moveEvent.clientX,
            moveEvent.clientY,
          );
          if (distance < MARQUEE_DRAG_THRESHOLD_PX) {
            return;
          }
          active.started = true;
          scrollElement.setPointerCapture(active.pointerId);
        }

        active.clientX = moveEvent.clientX;
        active.clientY = moveEvent.clientY;
        applySwipeAt(moveEvent.clientX, moveEvent.clientY, active);
        stopAutoScroll();
        startAutoScroll();
      };

      const onPointerEnd = (endEvent: PointerEvent) => {
        const active = sessionRef.current;
        if (!active || endEvent.pointerId !== active.pointerId) {
          return;
        }

        if (active.started) {
          active.clientX = endEvent.clientX;
          active.clientY = endEvent.clientY;
          applySwipeAt(endEvent.clientX, endEvent.clientY, active);
          if (scrollElement.hasPointerCapture(active.pointerId)) {
            scrollElement.releasePointerCapture(active.pointerId);
          }
        }

        endSession(active, active.started);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
    },
    [applySwipeAt, enabled, endSession, scrollElementRef, startAutoScroll, stopAutoScroll],
  );

  return { onViewportPointerDown };
}
