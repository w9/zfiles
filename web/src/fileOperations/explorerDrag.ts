import type { FileClipboardOperation } from "./clipboard";
import { isDescendantPath, parentExplorerPath } from "./paths";

/** Custom MIME type for in-app explorer path drags (not OS file drops). */
export const EXPLORER_DRAG_MIME = "application/x-zfiles-explorer-paths";

export type ExplorerDragPayload = {
  paths: string[];
};

export function resolveExplorerDragPaths(
  draggedPath: string,
  selectedPaths: ReadonlySet<string>,
): string[] {
  if (selectedPaths.has(draggedPath) && selectedPaths.size > 0) {
    return Array.from(selectedPaths);
  }
  return [draggedPath];
}

/**
 * Default is move (`cut`). Copy when Ctrl (Win/Linux) or Alt/Option (macOS) is held.
 * Either modifier requests copy so both platforms are covered without UA sniffing.
 */
export function explorerDragOperationFromModifiers(modifiers: {
  ctrlKey: boolean;
  altKey: boolean;
}): FileClipboardOperation {
  if (modifiers.ctrlKey || modifiers.altKey) {
    return "copy";
  }
  return "cut";
}

export function canDropExplorerPaths(options: {
  destDir: string;
  sourcePaths: readonly string[];
  operation: FileClipboardOperation;
}): boolean {
  const { destDir, sourcePaths, operation } = options;
  if (sourcePaths.length === 0) {
    return false;
  }

  for (const source of sourcePaths) {
    if (isDescendantPath(destDir, source)) {
      return false;
    }
  }

  if (operation === "cut") {
    const allAlreadyThere = sourcePaths.every(
      (source) => parentExplorerPath(source) === destDir,
    );
    if (allAlreadyThere) {
      return false;
    }
  }

  return true;
}

export function serializeExplorerDragPayload(paths: readonly string[]): string {
  return JSON.stringify({ paths: [...paths] } satisfies ExplorerDragPayload);
}

export function parseExplorerDragPayload(raw: string): ExplorerDragPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("paths" in parsed) ||
      !Array.isArray((parsed as ExplorerDragPayload).paths)
    ) {
      return null;
    }
    const paths = (parsed as ExplorerDragPayload).paths.filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
    if (paths.length === 0) {
      return null;
    }
    return { paths };
  } catch {
    return null;
  }
}

function dataTransferTypesList(
  types: readonly string[] | DOMStringList | undefined,
): string[] {
  if (!types) {
    return [];
  }
  return Array.from(types as ArrayLike<string>);
}

export function dragEventHasExplorerPaths(
  types: readonly string[] | DOMStringList | undefined,
): boolean {
  return dataTransferTypesList(types).includes(EXPLORER_DRAG_MIME);
}

export function dragEventHasExternalFiles(
  types: readonly string[] | DOMStringList | undefined,
): boolean {
  const list = dataTransferTypesList(types);
  // Prefer explorer MIME when both are present (should not happen for our drags).
  if (list.includes(EXPLORER_DRAG_MIME)) {
    return false;
  }
  return list.includes("Files");
}

export function setExplorerDragData(
  dataTransfer: DataTransfer,
  paths: readonly string[],
): void {
  const payload = serializeExplorerDragPayload(paths);
  dataTransfer.setData(EXPLORER_DRAG_MIME, payload);
  // Some browsers require a known type for the drag to start.
  dataTransfer.setData("text/plain", paths.join("\n"));
}

export function readExplorerDragPaths(dataTransfer: DataTransfer): string[] | null {
  const raw = dataTransfer.getData(EXPLORER_DRAG_MIME);
  if (!raw) {
    return null;
  }
  return parseExplorerDragPayload(raw)?.paths ?? null;
}

export function dropEffectForExplorerOperation(
  operation: FileClipboardOperation,
): DataTransfer["dropEffect"] {
  return operation === "copy" ? "copy" : "move";
}
