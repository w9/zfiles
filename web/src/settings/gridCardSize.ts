export type GridCardSize = {
  width: number;
  height: number;
};

export const GRID_GAP_PX = 12;

export const BUILTIN_DEFAULT_GRID_CARD_SIZE: GridCardSize = {
  width: 108,
  height: 108,
};

export const BUILTIN_MIN_GRID_CARD_SIZE: GridCardSize = {
  width: 48,
  height: 64,
};

/** Stored as 0 when the user chooses no limit. */
export const UNLIMITED_GRID_CARD_DIMENSION = 0;

export const GRID_CARD_SIZE_STORAGE_KEY = "zfiles-grid-card-size";
export const GRID_CARD_DEFAULT_SIZE_STORAGE_KEY = "zfiles-grid-card-default-size";
export const GRID_CARD_MIN_SIZE_STORAGE_KEY = "zfiles-grid-card-min-size";
export const GRID_CARD_MAX_SIZE_STORAGE_KEY = "zfiles-grid-card-max-size";

const MAX_PRACTICAL_DIMENSION = 4096;

function storage(): Storage | null {
  return typeof globalThis.localStorage === "object" && globalThis.localStorage
    ? globalThis.localStorage
    : null;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

export function parseGridCardSizeJson(
  raw: string | null,
  fallback: GridCardSize,
): GridCardSize {
  if (!raw) {
    return { ...fallback };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...fallback };
    }
    const record = parsed as Record<string, unknown>;
    const width = parsePositiveInt(record.width);
    const height = parsePositiveInt(record.height);
    if (width == null || height == null) {
      return { ...fallback };
    }
    return { width, height };
  } catch {
    return { ...fallback };
  }
}

export function parseGridCardMaxSizeJson(
  raw: string | null,
  fallback: GridCardSize,
): GridCardSize {
  if (!raw) {
    return { ...fallback };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...fallback };
    }
    const record = parsed as Record<string, unknown>;
    const widthRaw = record.width;
    const heightRaw = record.height;
    const width =
      widthRaw === UNLIMITED_GRID_CARD_DIMENSION
        ? UNLIMITED_GRID_CARD_DIMENSION
        : parsePositiveInt(widthRaw);
    const height =
      heightRaw === UNLIMITED_GRID_CARD_DIMENSION
        ? UNLIMITED_GRID_CARD_DIMENSION
        : parsePositiveInt(heightRaw);
    if (width == null || height == null) {
      return { ...fallback };
    }
    return { width, height };
  } catch {
    return { ...fallback };
  }
}

export function effectiveMaxDimension(value: number): number {
  return value === UNLIMITED_GRID_CARD_DIMENSION ? MAX_PRACTICAL_DIMENSION : value;
}

export function clampGridCardSize(
  size: GridCardSize,
  min: GridCardSize,
  max: GridCardSize,
): GridCardSize {
  const maxWidth = effectiveMaxDimension(max.width);
  const maxHeight = effectiveMaxDimension(max.height);
  return {
    width: Math.min(Math.max(size.width, min.width), maxWidth),
    height: Math.min(Math.max(size.height, min.height), maxHeight),
  };
}

export function computeGridColumnCount(
  containerWidth: number,
  cardWidth: number,
  gap = GRID_GAP_PX,
): number {
  if (containerWidth <= 0 || cardWidth <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
}

export function gridIconPixelSize(cardWidth: number, cardHeight: number): number {
  const nameBandPx = 36;
  const verticalPaddingPx = 16;
  const iconAreaHeight = Math.max(0, cardHeight - nameBandPx - verticalPaddingPx);
  const fromWidth = cardWidth * 0.54;
  const fromHeight = iconAreaHeight * 0.85;
  return Math.round(Math.max(16, Math.min(fromWidth, fromHeight, 160)));
}

export function readStoredGridCardDefaultSize(): GridCardSize {
  return parseGridCardSizeJson(
    storage()?.getItem(GRID_CARD_DEFAULT_SIZE_STORAGE_KEY) ?? null,
    BUILTIN_DEFAULT_GRID_CARD_SIZE,
  );
}

export function storeGridCardDefaultSize(size: GridCardSize): void {
  storage()?.setItem(GRID_CARD_DEFAULT_SIZE_STORAGE_KEY, JSON.stringify(size));
}

export function readStoredGridCardMinSize(): GridCardSize {
  return parseGridCardSizeJson(
    storage()?.getItem(GRID_CARD_MIN_SIZE_STORAGE_KEY) ?? null,
    BUILTIN_MIN_GRID_CARD_SIZE,
  );
}

export function storeGridCardMinSize(size: GridCardSize): void {
  storage()?.setItem(GRID_CARD_MIN_SIZE_STORAGE_KEY, JSON.stringify(size));
}

export function readStoredGridCardMaxSize(): GridCardSize {
  return parseGridCardMaxSizeJson(storage()?.getItem(GRID_CARD_MAX_SIZE_STORAGE_KEY) ?? null, {
    width: UNLIMITED_GRID_CARD_DIMENSION,
    height: UNLIMITED_GRID_CARD_DIMENSION,
  });
}

export function storeGridCardMaxSize(size: GridCardSize): void {
  storage()?.setItem(GRID_CARD_MAX_SIZE_STORAGE_KEY, JSON.stringify(size));
}

export function readStoredGridCardSize(): GridCardSize {
  const defaultSize = readStoredGridCardDefaultSize();
  const min = readStoredGridCardMinSize();
  const max = readStoredGridCardMaxSize();
  const parsed = parseGridCardSizeJson(
    storage()?.getItem(GRID_CARD_SIZE_STORAGE_KEY) ?? null,
    defaultSize,
  );
  return clampGridCardSize(parsed, min, max);
}

export function storeGridCardSize(size: GridCardSize): void {
  storage()?.setItem(GRID_CARD_SIZE_STORAGE_KEY, JSON.stringify(size));
}
