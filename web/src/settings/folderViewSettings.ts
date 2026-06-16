import type { SortingState } from "@tanstack/react-table";

import {
  readListingViewMode,
  writeListingViewMode,
  type ListingViewMode,
} from "../listingView";
import {
  BUILTIN_DEFAULT_GRID_CARD_SIZE,
  parseGridCardSizeJson,
  readStoredGridCardSize,
  storeGridCardSize,
  type GridCardSize,
} from "./gridCardSize";

export type FolderViewSettings = {
  viewMode?: ListingViewMode;
  columnSort?: SortingState;
  gridCardSize?: GridCardSize;
};

export type EffectiveFolderViewSettings = {
  viewMode: ListingViewMode;
  columnSort: SortingState;
  gridCardSize: GridCardSize;
};

export const DEFAULT_COLUMN_SORT: SortingState = [{ id: "name", desc: false }];

const FOLDER_OVERRIDES_STORAGE_KEY = "zfiles-folder-view-settings";
const GLOBAL_COLUMN_SORT_STORAGE_KEY = "zfiles-listing-column-sort";

const COLUMN_SORT_IDS = new Set(["name", "size", "modified"]);

function storage(): Storage | null {
  return typeof globalThis.localStorage === "object" && globalThis.localStorage
    ? globalThis.localStorage
    : null;
}

function parseColumnSortJson(raw: string | null): SortingState {
  if (!raw) {
    return [...DEFAULT_COLUMN_SORT];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...DEFAULT_COLUMN_SORT];
    }
    const next: SortingState = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const record = item as Record<string, unknown>;
      const id = record.id;
      const desc = record.desc;
      if (typeof id !== "string" || !COLUMN_SORT_IDS.has(id) || typeof desc !== "boolean") {
        continue;
      }
      next.push({ id, desc });
    }
    return next.length > 0 ? next : [...DEFAULT_COLUMN_SORT];
  } catch {
    return [...DEFAULT_COLUMN_SORT];
  }
}

export function readGlobalColumnSort(): SortingState {
  return parseColumnSortJson(storage()?.getItem(GLOBAL_COLUMN_SORT_STORAGE_KEY) ?? null);
}

export function writeGlobalColumnSort(sort: SortingState): void {
  storage()?.setItem(GLOBAL_COLUMN_SORT_STORAGE_KEY, JSON.stringify(sort));
}

function parseFolderOverridesJson(raw: string | null): Record<string, FolderViewSettings> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, FolderViewSettings> = {};
    for (const [path, value] of Object.entries(parsed)) {
      if (typeof path !== "string" || typeof value !== "object" || value === null) {
        continue;
      }
      const record = value as Record<string, unknown>;
      const settings: FolderViewSettings = {};
      if (record.viewMode === "table" || record.viewMode === "grid") {
        settings.viewMode = record.viewMode;
      }
      if (Array.isArray(record.columnSort)) {
        settings.columnSort = parseColumnSortJson(JSON.stringify(record.columnSort));
      }
      if (typeof record.gridCardSize === "object" && record.gridCardSize !== null) {
        settings.gridCardSize = parseGridCardSizeJson(
          JSON.stringify(record.gridCardSize),
          BUILTIN_DEFAULT_GRID_CARD_SIZE,
        );
      }
      if (
        settings.viewMode != null ||
        settings.columnSort != null ||
        settings.gridCardSize != null
      ) {
        result[path] = settings;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function readFolderOverridesMap(): Record<string, FolderViewSettings> {
  return parseFolderOverridesJson(
    storage()?.getItem(FOLDER_OVERRIDES_STORAGE_KEY) ?? null,
  );
}

function writeFolderOverridesMap(map: Record<string, FolderViewSettings>): void {
  const store = storage();
  if (!store) {
    return;
  }
  if (Object.keys(map).length === 0) {
    store.removeItem(FOLDER_OVERRIDES_STORAGE_KEY);
    return;
  }
  store.setItem(FOLDER_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
}

export function readFolderViewOverride(path: string): FolderViewSettings | null {
  return readFolderOverridesMap()[path] ?? null;
}

export function writeFolderViewOverride(path: string, partial: FolderViewSettings): void {
  const map = readFolderOverridesMap();
  const current = map[path] ?? {};
  const next: FolderViewSettings = { ...current, ...partial };
  map[path] = next;
  writeFolderOverridesMap(map);
}

export function clearAllFolderViewOverrides(): void {
  storage()?.removeItem(FOLDER_OVERRIDES_STORAGE_KEY);
}

export function readEffectiveFolderViewSettings(path: string): EffectiveFolderViewSettings {
  const override = readFolderViewOverride(path);
  return {
    viewMode: override?.viewMode ?? readListingViewMode(),
    columnSort: override?.columnSort ?? readGlobalColumnSort(),
    gridCardSize: override?.gridCardSize ?? readStoredGridCardSize(),
  };
}

export function applyGlobalListingSettings(settings: EffectiveFolderViewSettings): void {
  writeListingViewMode(settings.viewMode);
  writeGlobalColumnSort(settings.columnSort);
  storeGridCardSize(settings.gridCardSize);
  clearAllFolderViewOverrides();
}
