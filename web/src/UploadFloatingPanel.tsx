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
  UPLOAD_TRAY_EDGE_HIT_PX,
  UPLOAD_TRAY_MIN_HEIGHT_PX,
  UPLOAD_TRAY_MIN_WIDTH_PX,
  applyResizeDelta,
  clampUploadTrayGeometry,
  defaultUploadTrayGeometry,
  readStoredUploadTrayGeometry,
  storeUploadTrayGeometry,
  viewportSize,
  type ResizeEdge,
  type UploadTrayGeometry,
} from "./uploadTrayGeometry";

type UploadFloatingPanelProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
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
      origin: UploadTrayGeometry;
    }
  | {
      kind: "resize";
      pointerId: number;
      edge: ResizeEdge;
      startX: number;
      startY: number;
      origin: UploadTrayGeometry;
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
  { edge: "sw", className: "bottom-0 left-0 h-2 w-2 cursor-nesw-resize" },
];

function resolveInitialGeometry(
  anchor: HTMLElement | null,
): UploadTrayGeometry {
  const viewport = viewportSize();
  const stored = readStoredUploadTrayGeometry();
  if (stored) {
    return clampUploadTrayGeometry(stored, viewport);
  }
  if (anchor) {
    return defaultUploadTrayGeometry(anchor.getBoundingClientRect(), viewport);
  }
  return clampUploadTrayGeometry(
    {
      x: Math.max(0, viewport.width - UPLOAD_TRAY_MIN_WIDTH_PX),
      y: Math.max(0, viewport.height - UPLOAD_TRAY_MIN_HEIGHT_PX),
      width: UPLOAD_TRAY_MIN_WIDTH_PX,
      height: UPLOAD_TRAY_MIN_HEIGHT_PX,
    },
    viewport,
  );
}

export default function UploadFloatingPanel({
  open,
  anchorRef,
  onClose,
  children,
}: UploadFloatingPanelProps) {
  const [geometry, setGeometry] = useState<UploadTrayGeometry>(() =>
    resolveInitialGeometry(anchorRef.current),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    setGeometry(resolveInitialGeometry(anchorRef.current));
  }, [open, anchorRef]);

  const commitGeometry = useCallback((next: UploadTrayGeometry) => {
    const clamped = clampUploadTrayGeometry(next, viewportSize());
    geometryRef.current = clamped;
    setGeometry(clamped);
    storeUploadTrayGeometry(clamped);
  }, []);

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
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
        clampUploadTrayGeometry(
          applyResizeDelta(interaction.origin, interaction.edge, deltaX, deltaY, {
            minWidth: UPLOAD_TRAY_MIN_WIDTH_PX,
            minHeight: UPLOAD_TRAY_MIN_HEIGHT_PX,
          }),
          viewportSize(),
        ),
      );
    },
    [commitGeometry],
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
      {RESIZE_EDGES.map(({ edge, className }) => (
        <div
          key={edge}
          aria-hidden
          className={cn("absolute z-20 touch-none", className)}
          style={{
            ...(edge === "n" || edge === "s"
              ? { height: UPLOAD_TRAY_EDGE_HIT_PX }
              : {}),
            ...(edge === "e" || edge === "w" ? { width: UPLOAD_TRAY_EDGE_HIT_PX } : {}),
            ...(edge.length === 2 ? { width: UPLOAD_TRAY_EDGE_HIT_PX, height: UPLOAD_TRAY_EDGE_HIT_PX } : {}),
          }}
          onPointerDown={onResizePointerDown(edge)}
        />
      ))}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children({ onDragHandlePointerDown })}</div>
    </div>,
    document.body,
  );
}
