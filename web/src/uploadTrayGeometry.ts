import {
  clampPanelGeometry,
  parseStoredPanelGeometry,
  readStoredPanelGeometry,
  storePanelGeometry,
  viewportSize,
  FLOATING_PANEL_SHEET_BREAKPOINT_PX,
  type PanelGeometry,
  type ResizeEdge,
  type ViewportSize,
} from "./floatingPanelGeometry";

export {
  applyResizeDelta,
  FLOATING_PANEL_EDGE_HIT_PX as UPLOAD_TRAY_EDGE_HIT_PX,
  FLOATING_PANEL_SHEET_BREAKPOINT_PX as UPLOAD_TRAY_SHEET_BREAKPOINT_PX,
  type ResizeEdge,
  type ViewportSize,
} from "./floatingPanelGeometry";

export const UPLOAD_TRAY_GEOMETRY_STORAGE_KEY = "zfiles-upload-tray-geometry";
export const UPLOAD_TRAY_ANCHOR_OFFSET_PX = 8;

/** 2× the prior 28rem popover width. */
export const UPLOAD_TRAY_DEFAULT_WIDTH_PX = 896;
/** 2× the prior 20rem list cap plus header chrome. */
export const UPLOAD_TRAY_DEFAULT_HEIGHT_PX = 696;
export const UPLOAD_TRAY_MIN_WIDTH_PX = 320;
export const UPLOAD_TRAY_MIN_HEIGHT_PX = 240;

export type UploadTrayGeometry = PanelGeometry;

const UPLOAD_SIZE_LIMITS = {
  minWidth: UPLOAD_TRAY_MIN_WIDTH_PX,
  minHeight: UPLOAD_TRAY_MIN_HEIGHT_PX,
};

export function defaultUploadTrayGeometry(
  anchor: Pick<DOMRect, "left" | "right" | "top">,
  viewport: ViewportSize,
): UploadTrayGeometry {
  const width = UPLOAD_TRAY_DEFAULT_WIDTH_PX;
  const height = UPLOAD_TRAY_DEFAULT_HEIGHT_PX;
  const x = anchor.right - width;
  const y = anchor.top - height - UPLOAD_TRAY_ANCHOR_OFFSET_PX;
  return clampUploadTrayGeometry({ x, y, width, height }, viewport);
}

export function clampUploadTrayGeometry(
  geometry: UploadTrayGeometry,
  viewport: ViewportSize,
): UploadTrayGeometry {
  return clampPanelGeometry(geometry, viewport, UPLOAD_SIZE_LIMITS);
}

export function parseStoredUploadTrayGeometry(raw: string | null): UploadTrayGeometry | null {
  return parseStoredPanelGeometry(raw);
}

export function readStoredUploadTrayGeometry(): UploadTrayGeometry | null {
  return readStoredPanelGeometry(UPLOAD_TRAY_GEOMETRY_STORAGE_KEY);
}

export function storeUploadTrayGeometry(geometry: UploadTrayGeometry): void {
  storePanelGeometry(UPLOAD_TRAY_GEOMETRY_STORAGE_KEY, geometry);
}

export { viewportSize };

export function isUploadTraySheetLayout(viewportWidth = viewportSize().width): boolean {
  return viewportWidth < FLOATING_PANEL_SHEET_BREAKPOINT_PX;
}
