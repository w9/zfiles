import { useCallback } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";

import FloatingPanel, { resolveStoredOrDefaultGeometry } from "./FloatingPanel";
import {
  UPLOAD_TRAY_DEFAULT_HEIGHT_PX,
  UPLOAD_TRAY_DEFAULT_WIDTH_PX,
  UPLOAD_TRAY_GEOMETRY_STORAGE_KEY,
  UPLOAD_TRAY_MIN_HEIGHT_PX,
  UPLOAD_TRAY_MIN_WIDTH_PX,
  defaultUploadTrayGeometry,
  type UploadTrayGeometry,
} from "./uploadTrayGeometry";
import type { ViewportSize } from "./floatingPanelGeometry";

type UploadFloatingPanelProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: (options: {
    onDragHandlePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  }) => ReactNode;
};

const UPLOAD_SIZE_LIMITS = {
  minWidth: UPLOAD_TRAY_MIN_WIDTH_PX,
  minHeight: UPLOAD_TRAY_MIN_HEIGHT_PX,
};

function resolveUploadTrayGeometry(
  anchor: HTMLElement | null,
  viewport: ViewportSize,
): UploadTrayGeometry {
  const fallback =
    anchor != null
      ? defaultUploadTrayGeometry(anchor.getBoundingClientRect(), viewport)
      : {
          x: Math.max(0, viewport.width - UPLOAD_TRAY_DEFAULT_WIDTH_PX),
          y: Math.max(0, viewport.height - UPLOAD_TRAY_DEFAULT_HEIGHT_PX),
          width: UPLOAD_TRAY_DEFAULT_WIDTH_PX,
          height: UPLOAD_TRAY_DEFAULT_HEIGHT_PX,
        };
  return resolveStoredOrDefaultGeometry(
    UPLOAD_TRAY_GEOMETRY_STORAGE_KEY,
    viewport,
    UPLOAD_SIZE_LIMITS,
    fallback,
  );
}

export default function UploadFloatingPanel({
  open,
  anchorRef,
  onClose,
  children,
}: UploadFloatingPanelProps) {
  const resolveInitialGeometry = useCallback(
    (viewport: ViewportSize) => resolveUploadTrayGeometry(anchorRef.current, viewport),
    [anchorRef],
  );

  return (
    <FloatingPanel
      open={open}
      onClose={onClose}
      ariaLabel="Uploads"
      storageKey={UPLOAD_TRAY_GEOMETRY_STORAGE_KEY}
      resizable
      sizeLimits={UPLOAD_SIZE_LIMITS}
      resolveInitialGeometry={resolveInitialGeometry}
    >
      {children}
    </FloatingPanel>
  );
}
