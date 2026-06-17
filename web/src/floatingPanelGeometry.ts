export const FLOATING_PANEL_SHEET_BREAKPOINT_PX = 640;
export const FLOATING_PANEL_EDGE_HIT_PX = 6;

export type PanelGeometry = {
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

export type PanelSizeLimits = {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
};

export function clampPanelGeometry(
  geometry: PanelGeometry,
  viewport: ViewportSize,
  limits: PanelSizeLimits,
): PanelGeometry {
  const maxWidth = limits.maxWidth ?? viewport.width;
  const maxHeight = limits.maxHeight ?? viewport.height;
  const width = Math.min(Math.max(geometry.width, limits.minWidth), maxWidth, viewport.width);
  const height = Math.min(
    Math.max(geometry.height, limits.minHeight),
    maxHeight,
    viewport.height,
  );
  const x = Math.min(Math.max(geometry.x, 0), Math.max(0, viewport.width - width));
  const y = Math.min(Math.max(geometry.y, 0), Math.max(0, viewport.height - height));
  return { x, y, width, height };
}

export function centerPanelGeometry(
  width: number,
  height: number,
  viewport: ViewportSize,
  limits: PanelSizeLimits,
): PanelGeometry {
  return clampPanelGeometry(
    {
      x: (viewport.width - width) / 2,
      y: (viewport.height - height) / 2,
      width,
      height,
    },
    viewport,
    limits,
  );
}

export function applyResizeDelta(
  geometry: PanelGeometry,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
  limits: PanelSizeLimits,
): PanelGeometry {
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

export function parseStoredPanelGeometry(raw: string | null): PanelGeometry | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<PanelGeometry>;
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

export function readStoredPanelGeometry(storageKey: string): PanelGeometry | null {
  if (typeof window === "undefined") {
    return null;
  }
  return parseStoredPanelGeometry(window.localStorage.getItem(storageKey));
}

export function storePanelGeometry(storageKey: string, geometry: PanelGeometry): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(geometry));
}

export function viewportSize(fallback: ViewportSize = { width: 896, height: 696 }): ViewportSize {
  if (typeof window === "undefined") {
    return fallback;
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function isFloatingPanelSheetLayout(
  viewportWidth = viewportSize().width,
): boolean {
  return viewportWidth < FLOATING_PANEL_SHEET_BREAKPOINT_PX;
}
