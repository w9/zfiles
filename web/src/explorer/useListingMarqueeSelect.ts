import { useCallback, useEffect, useRef, type RefObject } from "react";

import {
  MARQUEE_AUTO_SCROLL_MARGIN_PX,
  MARQUEE_AUTO_SCROLL_STEP_PX,
  MARQUEE_DRAG_THRESHOLD_PX,
  type ClientRect,
  type ListingMarqueeLayoutResolver,
  type MarqueeModifiers,
  clientXToContentX,
  clientYToContentY,
  collectDomEntryRectsFromViewport,
  computeMarqueeSelection,
  contentMarqueeToViewportLocal,
  findEntryPathAtPoint,
  hitTestEntryPaths,
  normalizeMarqueeRect,
  pointerDistance,
  selectionSetsEqual,
  shouldClearMultiSelectionOnEmptyClick,
  shouldIgnoreMarqueePointerTarget,
  syncListingSelectionDom,
} from "@/explorer/listingMarqueeSelect";
import { paintMarqueeOverlay } from "@/explorer/MarqueeOverlay";

export type UseListingMarqueeSelectOptions = {
  selectedPaths: Set<string>;
  enabled?: boolean;
  allowEmptyClickClear?: boolean;
  scrollElementRef: React.RefObject<HTMLElement | null>;
  layoutRef?: RefObject<ListingMarqueeLayoutResolver | null>;
  onSelectionChange: (paths: Set<string>, primaryPath: string | null) => void;
  onEmptyClick?: () => void;
};

export type UseListingMarqueeSelectResult = {
  /** True while a marquee drag is in progress (ref — does not trigger renders). */
  isActiveRef: RefObject<boolean>;
  /** Mount target for the viewport-local marquee rectangle. */
  overlayRef: RefObject<HTMLDivElement | null>;
  onViewportPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
};

type DragSession = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  started: boolean;
  baseSelection: Set<string>;
  modifiers: MarqueeModifiers;
  lastHoveredPath: string | null;
  startContentX: number | null;
  startContentY: number | null;
  lastSelection: Set<string> | null;
  pointerTarget: EventTarget | null;
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

function setViewportMarqueeActive(scrollElement: HTMLElement, active: boolean) {
  scrollElement.classList.toggle("select-none", active);
}

export function useListingMarqueeSelect({
  selectedPaths,
  enabled = true,
  allowEmptyClickClear = true,
  scrollElementRef,
  layoutRef,
  onSelectionChange,
  onEmptyClick,
}: UseListingMarqueeSelectOptions): UseListingMarqueeSelectResult {
  const isActiveRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const pendingClickSuppressRef = useRef<((event: MouseEvent) => void) | null>(
    null,
  );
  const autoScrollFrameRef = useRef<number | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const selectedPathsRef = useRef(selectedPaths);
  const onEmptyClickRef = useRef(onEmptyClick);
  const allowEmptyClickClearRef = useRef(allowEmptyClickClear);

  onSelectionChangeRef.current = onSelectionChange;
  selectedPathsRef.current = selectedPaths;
  onEmptyClickRef.current = onEmptyClick;
  allowEmptyClickClearRef.current = allowEmptyClickClear;

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current != null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const applyMarqueeAt = useCallback(
    (
      clientX: number,
      clientY: number,
      session: DragSession,
      options?: { finalize?: boolean },
    ) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }

      if (session.started && session.startContentX == null) {
        session.startContentX = clientXToContentX(scrollElement, session.startX);
      }
      if (session.started && session.startContentY == null) {
        session.startContentY = clientYToContentY(scrollElement, session.startY);
      }

      const contentX = clientXToContentX(scrollElement, clientX);
      const contentY = clientYToContentY(scrollElement, clientY);
      if (session.startContentX != null && session.startContentY != null) {
        paintMarqueeOverlay(
          overlayRef.current,
          contentMarqueeToViewportLocal({
            startContentX: session.startContentX,
            startContentY: session.startContentY,
            contentX,
            contentY,
            scrollLeft: scrollElement.scrollLeft,
            scrollTop: scrollElement.scrollTop,
          }),
        );
      }

      const layout = layoutRef?.current;
      const usesContentMarquee =
        layout?.hitTestContentMarquee != null && session.startContentY != null;

      const marquee = normalizeMarqueeRect(
        session.startX,
        session.startY,
        clientX,
        clientY,
      );
      const entryRects = usesContentMarquee
        ? []
        : collectEntryRectsFromViewport(scrollElement, layoutRef);

      const hitPaths =
        usesContentMarquee && layout != null
          ? layout.hitTestContentMarquee(scrollElement, {
              contentTop: session.startContentY!,
              contentBottom: contentY,
              clientLeft: Math.min(session.startX, clientX),
              clientRight: Math.max(session.startX, clientX),
            })
          : hitTestEntryPaths(marquee, entryRects);

      const nextSelection = computeMarqueeSelection(
        session.baseSelection,
        hitPaths,
        session.modifiers,
      );

      const isReplaceMode =
        !session.modifiers.shiftKey &&
        !session.modifiers.ctrlKey &&
        !session.modifiers.metaKey;
      const resolvedSelection =
        isReplaceMode &&
        hitPaths.length === 0 &&
        session.started &&
        !options?.finalize
          ? (session.lastSelection ?? session.baseSelection)
          : nextSelection;

      const hoveredPath =
        usesContentMarquee && layout != null
          ? layout.findPathAtClientPoint(scrollElement, clientX, clientY)
          : findEntryPathAtPoint(entryRects, clientX, clientY);
      if (hoveredPath) {
        session.lastHoveredPath = hoveredPath;
      }

      const selectionChanged =
        session.lastSelection == null ||
        !selectionSetsEqual(session.lastSelection, resolvedSelection);
      if (selectionChanged) {
        // Live chrome only — avoid React row commits while the rect is moving.
        syncListingSelectionDom(scrollElement, resolvedSelection);
        session.lastSelection = new Set(resolvedSelection);
      }
      if (options?.finalize) {
        onSelectionChangeRef.current(resolvedSelection, session.lastHoveredPath);
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

  const detachScrollListenerRef = useRef<(() => void) | null>(null);

  const endSession = useCallback(
    (_session: DragSession | null, didMarquee: boolean) => {
      sessionRef.current = null;
      isActiveRef.current = false;
      paintMarqueeOverlay(overlayRef.current, null);
      detachScrollListenerRef.current?.();
      detachScrollListenerRef.current = null;
      const scrollElement = scrollElementRef.current;
      if (scrollElement) {
        setViewportMarqueeActive(scrollElement, false);
      }
      stopAutoScroll();
      if (didMarquee) {
        suppressMarqueeEndClick(pendingClickSuppressRef);
      }
    },
    [scrollElementRef, stopAutoScroll],
  );

  useEffect(
    () => () => {
      stopAutoScroll();
      detachScrollListenerRef.current?.();
      detachScrollListenerRef.current = null;
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
      if (shouldIgnoreMarqueePointerTarget(event.target)) {
        return;
      }
      if (!enabled && !onEmptyClickRef.current) {
        return;
      }

      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }

      const session: DragSession = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
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
        startContentX: null,
        startContentY: null,
        lastSelection: null,
        pointerTarget: event.target,
      };
      sessionRef.current = session;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const active = sessionRef.current;
        if (!active || moveEvent.pointerId !== active.pointerId) {
          return;
        }

        if (!enabled || active.pointerType === "touch") {
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
          isActiveRef.current = true;
          setViewportMarqueeActive(scrollElement, true);
          scrollElement.setPointerCapture(active.pointerId);
          detachScrollListenerRef.current?.();
          const onScroll = () => {
            const live = sessionRef.current;
            if (!live?.started) {
              return;
            }
            applyMarqueeAt(live.clientX, live.clientY, live);
          };
          scrollElement.addEventListener("scroll", onScroll, { passive: true });
          detachScrollListenerRef.current = () => {
            scrollElement.removeEventListener("scroll", onScroll);
          };
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
          applyMarqueeAt(endEvent.clientX, endEvent.clientY, active, {
            finalize: true,
          });
          if (scrollElement.hasPointerCapture(active.pointerId)) {
            scrollElement.releasePointerCapture(active.pointerId);
          }
        } else if (
          allowEmptyClickClearRef.current &&
          shouldClearMultiSelectionOnEmptyClick({
            started: active.started,
            modifiers: active.modifiers,
            target: active.pointerTarget,
          })
        ) {
          onEmptyClickRef.current?.();
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
    [
      applyMarqueeAt,
      enabled,
      endSession,
      scrollElementRef,
      startAutoScroll,
      stopAutoScroll,
    ],
  );

  return {
    isActiveRef,
    overlayRef,
    onViewportPointerDown,
  };
}
