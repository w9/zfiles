import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  MARQUEE_AUTO_SCROLL_MARGIN_PX,
  MARQUEE_AUTO_SCROLL_STEP_PX,
  MARQUEE_DRAG_THRESHOLD_PX,
  type ClientRect,
  type ListingMarqueeLayoutResolver,
  type MarqueeModifiers,
  clientYToContentY,
  collectDomEntryRectsFromViewport,
  computeMarqueeSelection,
  findEntryPathAtPoint,
  hitTestEntryPaths,
  normalizeMarqueeRect,
  pointerDistance,
  selectionSetsEqual,
  shouldIgnoreMarqueePointerTarget,
} from "@/explorer/listingMarqueeSelect";

export type UseListingMarqueeSelectOptions = {
  selectedPaths: Set<string>;
  enabled?: boolean;
  scrollElementRef: React.RefObject<HTMLElement | null>;
  layoutRef?: RefObject<ListingMarqueeLayoutResolver | null>;
  onSelectionChange: (paths: Set<string>, primaryPath: string | null) => void;
};

export type UseListingMarqueeSelectResult = {
  isActive: boolean;
  marqueeRect: ClientRect | null;
  onViewportPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
};

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  started: boolean;
  baseSelection: Set<string>;
  modifiers: MarqueeModifiers;
  lastHoveredPath: string | null;
  startContentY: number | null;
  lastSelection: Set<string> | null;
};

function collectEntryRectsFromViewport(
  scrollElement: HTMLElement,
  layoutRef?: RefObject<ListingMarqueeLayoutResolver | null>,
): Array<{ path: string; rect: ClientRect }> {
  const layout = layoutRef?.current;
  if (layout) {
    return layout.getEntryRects(scrollElement);
  }
  return collectDomEntryRectsFromViewport(scrollElement);
}

function suppressMarqueeEndClick(
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

export function useListingMarqueeSelect({
  selectedPaths,
  enabled = true,
  scrollElementRef,
  layoutRef,
  onSelectionChange,
}: UseListingMarqueeSelectOptions): UseListingMarqueeSelectResult {
  const [isActive, setIsActive] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<ClientRect | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const pendingClickSuppressRef = useRef<((event: MouseEvent) => void) | null>(
    null,
  );
  const autoScrollFrameRef = useRef<number | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const selectedPathsRef = useRef(selectedPaths);

  onSelectionChangeRef.current = onSelectionChange;
  selectedPathsRef.current = selectedPaths;

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current != null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const applyMarqueeAt = useCallback(
    (clientX: number, clientY: number, session: DragSession) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }

      const marquee = normalizeMarqueeRect(
        session.startX,
        session.startY,
        clientX,
        clientY,
      );
      setMarqueeRect(marquee);

      if (session.started && session.startContentY == null) {
        session.startContentY = clientYToContentY(scrollElement, session.startY);
      }

      const layout = layoutRef?.current;
      const usesContentMarquee =
        layout?.hitTestContentMarquee != null && session.startContentY != null;

      const entryRects = usesContentMarquee
        ? []
        : collectEntryRectsFromViewport(scrollElement, layoutRef);

      const hitPaths =
        usesContentMarquee && layout != null
          ? layout.hitTestContentMarquee(scrollElement, {
              contentTop: session.startContentY!,
              contentBottom: clientYToContentY(scrollElement, clientY),
              clientLeft: Math.min(session.startX, clientX),
              clientRight: Math.max(session.startX, clientX),
            })
          : hitTestEntryPaths(marquee, entryRects);

      const nextSelection = computeMarqueeSelection(
        session.baseSelection,
        hitPaths,
        session.modifiers,
      );

      const hoveredPath =
        usesContentMarquee && layout != null
          ? layout.findPathAtClientPoint(scrollElement, clientX, clientY)
          : findEntryPathAtPoint(entryRects, clientX, clientY);
      if (hoveredPath) {
        session.lastHoveredPath = hoveredPath;
      }

      if (
        session.lastSelection == null ||
        !selectionSetsEqual(session.lastSelection, nextSelection)
      ) {
        onSelectionChangeRef.current(nextSelection, session.lastHoveredPath);
        session.lastSelection = new Set(nextSelection);
      }
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
      applyMarqueeAt(session.clientX, session.clientY, session);
    }

    autoScrollFrameRef.current = requestAnimationFrame(startAutoScroll);
  }, [applyMarqueeAt, scrollElementRef, stopAutoScroll]);

  const endSession = useCallback(
    (session: DragSession | null, didMarquee: boolean) => {
      sessionRef.current = null;
      setIsActive(false);
      setMarqueeRect(null);
      stopAutoScroll();
      if (didMarquee) {
        suppressMarqueeEndClick(pendingClickSuppressRef);
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
      if (!enabled || event.button !== 0) {
        return;
      }
      if (shouldIgnoreMarqueePointerTarget(event.target)) {
        return;
      }

      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }

      const session: DragSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        started: false,
        baseSelection: new Set(selectedPathsRef.current),
        modifiers: {
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
        },
        lastHoveredPath: null,
        startContentY: null,
        lastSelection: null,
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
          setIsActive(true);
          scrollElement.setPointerCapture(active.pointerId);
        }

        active.clientX = moveEvent.clientX;
        active.clientY = moveEvent.clientY;
        applyMarqueeAt(moveEvent.clientX, moveEvent.clientY, active);
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
          applyMarqueeAt(endEvent.clientX, endEvent.clientY, active);
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
    [applyMarqueeAt, enabled, endSession, scrollElementRef, startAutoScroll, stopAutoScroll],
  );

  return {
    isActive,
    marqueeRect,
    onViewportPointerDown,
  };
}
