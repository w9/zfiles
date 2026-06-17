import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import {
  FLOATING_PANEL_EDGE_HIT_PX,
  applyResizeDelta,
  clampPanelGeometry,
  readStoredPanelGeometry,
  storePanelGeometry,
  viewportSize,
  type PanelGeometry,
  type PanelSizeLimits,
  type ResizeEdge,
  type ViewportSize,
} from "./floatingPanelGeometry";

export type FloatingPanelProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  storageKey: string;
  resizable?: boolean;
  sizeLimits: PanelSizeLimits;
  resolveInitialGeometry: (viewport: ViewportSize) => PanelGeometry;
  children: (options: {
    onDragHandlePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  }) => ReactNode;
};

type InteractionState =
  | {
      kind: "drag";
      pointerId: number;
      startX: number;
      startY: number;
      origin: PanelGeometry;
    }
  | {
      kind: "resize";
      pointerId: number;
      edge: ResizeEdge;
      startX: number;
      startY: number;
      origin: PanelGeometry;
    };

const RESIZE_EDGES: Array<{
  edge: ResizeEdge;
  className: string;
}> = [
  { edge: "n", className: "top-0 right-2 left-2 h-1.5 cursor-ns-resize" },
  { edge: "s", className: "right-2 bottom-0 left-2 h-1.5 cursor-ns-resize" },
  { edge: "e", className: "top-2 right-0 bottom-2 w-1.5 cursor-ew-resize" },
  { edge: "w", className: "top-2 bottom-2 left-0 w-1.5 cursor-ew-resize" },
  { edge: "ne", className: "top-0 right-0 h-2 w-2 cursor-nesw-resize" },
  { edge: "nw", className: "top-0 left-0 h-2 w-2 cursor-nwse-resize" },
  { edge: "se", className: "right-0 bottom-0 h-2 w-2 cursor-nwse-resize" },
  { edge: "sw", className: "bottom-0 left-0 h-2 w-2 cursor-nwse-resize" },
];

export default function FloatingPanel({
  open,
  onClose,
  ariaLabel,
  storageKey,
  resizable = true,
  sizeLimits,
  resolveInitialGeometry,
  children,
}: FloatingPanelProps) {
  const [geometry, setGeometry] = useState<PanelGeometry>(() =>
    resolveInitialGeometry(viewportSize()),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    setGeometry(resolveInitialGeometry(viewportSize()));
  }, [open, resolveInitialGeometry]);

  const commitGeometry = useCallback(
    (next: PanelGeometry) => {
      const clamped = clampPanelGeometry(next, viewportSize(), sizeLimits);
      geometryRef.current = clamped;
      setGeometry(clamped);
      storePanelGeometry(storageKey, clamped);
    },
    [sizeLimits, storageKey],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onResize = () => {
      commitGeometry(geometryRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, commitGeometry]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const onDragHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    panelRef.current?.setPointerCapture(event.pointerId);
    interactionRef.current = {
      kind: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: geometryRef.current,
    };
  }, []);

  const onResizePointerDown = useCallback(
    (edge: ResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      panelRef.current?.setPointerCapture(event.pointerId);
      interactionRef.current = {
        kind: "resize",
        pointerId: event.pointerId,
        edge,
        startX: event.clientX,
        startY: event.clientY,
        origin: geometryRef.current,
      };
    },
    [],
  );

  const onPanelPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;
      if (interaction.kind === "drag") {
        commitGeometry({
          ...interaction.origin,
          x: interaction.origin.x + deltaX,
          y: interaction.origin.y + deltaY,
        });
        return;
      }
      commitGeometry(
        clampPanelGeometry(
          applyResizeDelta(
            interaction.origin,
            interaction.edge,
            deltaX,
            deltaY,
            sizeLimits,
          ),
          viewportSize(),
          sizeLimits,
        ),
      );
    },
    [commitGeometry, sizeLimits],
  );

  const onPanelPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }
    interactionRef.current = null;
    if (panelRef.current?.hasPointerCapture(event.pointerId)) {
      panelRef.current.releasePointerCapture(event.pointerId);
    }
  }, []);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-[0_24px_64px_-16px_rgba(0,0,0,0.14),0_8px_20px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45),0_8px_20px_-8px_rgba(0,0,0,0.28)]",
      )}
      style={{
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
      }}
      onPointerMove={onPanelPointerMove}
      onPointerUp={onPanelPointerUp}
      onPointerCancel={onPanelPointerUp}
    >
      {resizable
        ? RESIZE_EDGES.map(({ edge, className }) => (
            <div
              key={edge}
              aria-hidden
              className={cn("absolute z-20 touch-none", className)}
              style={{
                ...(edge === "n" || edge === "s"
                  ? { height: FLOATING_PANEL_EDGE_HIT_PX }
                  : {}),
                ...(edge === "e" || edge === "w"
                  ? { width: FLOATING_PANEL_EDGE_HIT_PX }
                  : {}),
                ...(edge.length === 2
                  ? { width: FLOATING_PANEL_EDGE_HIT_PX, height: FLOATING_PANEL_EDGE_HIT_PX }
                  : {}),
              }}
              onPointerDown={onResizePointerDown(edge)}
            />
          ))
        : null}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children({ onDragHandlePointerDown })}
      </div>
    </div>,
    document.body,
  );
}

export function resolveStoredOrDefaultGeometry(
  storageKey: string,
  viewport: ViewportSize,
  sizeLimits: PanelSizeLimits,
  defaultGeometry: PanelGeometry,
): PanelGeometry {
  const stored = readStoredPanelGeometry(storageKey);
  if (stored) {
    return clampPanelGeometry(stored, viewport, sizeLimits);
  }
  return clampPanelGeometry(defaultGeometry, viewport, sizeLimits);
}
