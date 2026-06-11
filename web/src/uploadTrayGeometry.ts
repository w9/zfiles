export const UPLOAD_TRAY_GEOMETRY_STORAGE_KEY = "zfiles-upload-tray-geometry";
export const UPLOAD_TRAY_SHEET_BREAKPOINT_PX = 640;
export const UPLOAD_TRAY_ANCHOR_OFFSET_PX = 8;
export const UPLOAD_TRAY_EDGE_HIT_PX = 6;

/** 2× the prior 28rem popover width. */
export const UPLOAD_TRAY_DEFAULT_WIDTH_PX = 896;
/** 2× the prior 20rem list cap plus header chrome. */
export const UPLOAD_TRAY_DEFAULT_HEIGHT_PX = 696;
export const UPLOAD_TRAY_MIN_WIDTH_PX = 320;
export const UPLOAD_TRAY_MIN_HEIGHT_PX = 240;

export type UploadTrayGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type ViewportSize = {
  width: number;
  height: number;
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
  const width = Math.min(
    Math.max(geometry.width, UPLOAD_TRAY_MIN_WIDTH_PX),
    viewport.width,
  );
  const height = Math.min(
    Math.max(geometry.height, UPLOAD_TRAY_MIN_HEIGHT_PX),
    viewport.height,
  );
  const x = Math.min(Math.max(geometry.x, 0), Math.max(0, viewport.width - width));
  const y = Math.min(Math.max(geometry.y, 0), Math.max(0, viewport.height - height));
  return { x, y, width, height };
}

export function applyResizeDelta(
  geometry: UploadTrayGeometry,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
  limits: { minWidth: number; minHeight: number },
): UploadTrayGeometry {
  let { x, y, width, height } = geometry;

  if (edge.includes("e")) {
    width += deltaX;
  }
  if (edge.includes("w")) {
    width -= deltaX;
    x += deltaX;
  }
  if (edge.includes("s")) {
    height += deltaY;
  }
  if (edge.includes("n")) {
    height -= deltaY;
    y += deltaY;
  }

  if (width < limits.minWidth) {
    if (edge.includes("w")) {
      x -= limits.minWidth - width;
    }
    width = limits.minWidth;
  }
  if (height < limits.minHeight) {
    if (edge.includes("n")) {
      y -= limits.minHeight - height;
    }
    height = limits.minHeight;
  }

  return { x, y, width, height };
}

export function parseStoredUploadTrayGeometry(raw: string | null): UploadTrayGeometry | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<UploadTrayGeometry>;
    if (
      typeof value.x !== "number" ||
      typeof value.y !== "number" ||
      typeof value.width !== "number" ||
      typeof value.height !== "number" ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.width) ||
      !Number.isFinite(value.height)
    ) {
      return null;
    }
    return {
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
    };
  } catch {
    return null;
  }
}

export function readStoredUploadTrayGeometry(): UploadTrayGeometry | null {
  if (typeof window === "undefined") {
    return null;
  }
  return parseStoredUploadTrayGeometry(
    window.localStorage.getItem(UPLOAD_TRAY_GEOMETRY_STORAGE_KEY),
  );
}

export function storeUploadTrayGeometry(geometry: UploadTrayGeometry): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    UPLOAD_TRAY_GEOMETRY_STORAGE_KEY,
    JSON.stringify(geometry),
  );
}

export function viewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: UPLOAD_TRAY_DEFAULT_WIDTH_PX, height: UPLOAD_TRAY_DEFAULT_HEIGHT_PX };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function isUploadTraySheetLayout(viewportWidth = viewportSize().width): boolean {
  return viewportWidth < UPLOAD_TRAY_SHEET_BREAKPOINT_PX;
}
