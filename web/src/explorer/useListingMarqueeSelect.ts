import { useCallback, useEffect, useRef, useState } from "react";

import {
  MARQUEE_AUTO_SCROLL_MARGIN_PX,
  MARQUEE_AUTO_SCROLL_STEP_PX,
  MARQUEE_DRAG_THRESHOLD_PX,
  type ClientRect,
  type MarqueeModifiers,
  computeMarqueeSelection,
  findEntryPathAtPoint,
  hitTestEntryPaths,
  normalizeMarqueeRect,
  pointerDistance,
  shouldIgnoreMarqueePointerTarget,
} from "@/explorer/listingMarqueeSelect";

export type UseListingMarqueeSelectOptions = {
  selectedPaths: Set<string>;
  enabled?: boolean;
  scrollElementRef: React.RefObject<HTMLElement | null>;
  onSelectionChange: (paths: Set<string>, primaryPath: string | null) => void;
};

export type UseListingMarqueeSelectResult = {
  isActive: boolean;
  marqueeRect: ClientRect | null;
  consumeClickSuppression: () => boolean;
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
};

function collectEntryRectsFromViewport(
  scrollElement: HTMLElement,
): Array<{ path: string; rect: ClientRect }> {
  const nodes = scrollElement.querySelectorAll<HTMLElement>(
    "[data-listing-entry][data-listing-path]",
  );
  return Array.from(nodes).map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      path: node.dataset.listingPath ?? "",
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
    };
  });
}

export function useListingMarqueeSelect({
  selectedPaths,
  enabled = true,
  scrollElementRef,
  onSelectionChange,
}: UseListingMarqueeSelectOptions): UseListingMarqueeSelectResult {
  const [isActive, setIsActive] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<ClientRect | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
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

      const entryRects = collectEntryRectsFromViewport(scrollElement);
      const hitPaths = hitTestEntryPaths(marquee, entryRects);
      const nextSelection = computeMarqueeSelection(
        session.baseSelection,
        hitPaths,
        session.modifiers,
      );

      const hoveredPath = findEntryPathAtPoint(entryRects, clientX, clientY);
      if (hoveredPath) {
        session.lastHoveredPath = hoveredPath;
      }

      onSelectionChangeRef.current(nextSelection, session.lastHoveredPath);
    },
    [scrollElementRef],
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
        suppressClickRef.current = true;
      }
    },
    [stopAutoScroll],
  );

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

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

  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) {
      return false;
    }
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    isActive,
    marqueeRect,
    consumeClickSuppression,
    onViewportPointerDown,
  };
}
