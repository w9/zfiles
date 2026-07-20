import type { FileClipboardOperation } from "./clipboard";
import { basename, isDescendantPath, parentExplorerPath } from "./paths";

/** Mark icon / filename hit targets that may start an item drag when unselected. */
export const EXPLORER_DRAG_HANDLE_ATTR = "data-explorer-drag-handle";

/** Mark selected entry chrome that may start a drag anywhere on the highlight. */
export const EXPLORER_DRAG_SURFACE_ATTR = "data-explorer-drag-surface";

const EXPLORER_DROP_ID_PREFIX = "explorer-drop:";

export function explorerDropIdForDir(destDir: string): string {
  return `${EXPLORER_DROP_ID_PREFIX}${destDir}`;
}

export function destDirFromExplorerDropId(id: string | number): string | null {
  const value = String(id);
  if (!value.startsWith(EXPLORER_DROP_ID_PREFIX)) {
    return null;
  }
  return value.slice(EXPLORER_DROP_ID_PREFIX.length);
}

/**
 * Unselected items: only icon/filename handles. Selected items: any point on the
 * entry chrome (selection highlight) may start the drag.
 */
export function canStartExplorerEntryDrag(options: {
  target: EventTarget | null;
  isSelected: boolean;
}): boolean {
  if (options.isSelected) {
    return true;
  }
  if (
    options.target == null ||
    typeof options.target !== "object" ||
    typeof (options.target as Element).closest !== "function"
  ) {
    return false;
  }
  return (
    (options.target as Element).closest(`[${EXPLORER_DRAG_HANDLE_ATTR}]`) != null
  );
}

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
 * Default is move (`cut`). Copy when Ctrl, Alt/Option, or Meta/Cmd is held.
 */
export function explorerDragOperationFromModifiers(modifiers: {
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): FileClipboardOperation {
  if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) {
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

/** Used by OS upload drop to ignore in-app path drags if both ever appear. */
export const EXPLORER_DRAG_MIME = "application/x-zfiles-explorer-paths";

function dataTransferTypesList(
  types: readonly string[] | DOMStringList | undefined,
): string[] {
  if (!types) {
    return [];
  }
  return Array.from(types as ArrayLike<string>);
}

export function dragEventHasExternalFiles(
  types: readonly string[] | DOMStringList | undefined,
): boolean {
  const list = dataTransferTypesList(types);
  if (list.includes(EXPLORER_DRAG_MIME)) {
    return false;
  }
  return list.includes("Files");
}

export type ExplorerDragOverlayCounts = {
  fileCount: number;
  folderCount: number;
};

/** Middle-ellipsis for long single-file names in the drag overlay. */
export function middleEllipsizeName(
  name: string,
  options?: { head?: number; tail?: number },
): string {
  const head = options?.head ?? 14;
  const tail = options?.tail ?? 14;
  if (name.length <= head + tail + 1) {
    return name;
  }
  return `${name.slice(0, head)}…${name.slice(name.length - tail)}`;
}

export function formatExplorerDragOverlayText(options: {
  paths: readonly string[];
  operation: FileClipboardOperation;
  counts: ExplorerDragOverlayCounts;
  t: (key: string, params?: Record<string, string | number>) => string;
}): string {
  const { paths, operation, counts, t } = options;
  const action =
    operation === "copy"
      ? t("explorer.drag.overlay.copy")
      : t("explorer.drag.overlay.move");

  if (paths.length === 1) {
    return t("explorer.drag.overlay.badge", {
      action,
      label: middleEllipsizeName(basename(paths[0] ?? "")),
    });
  }

  const { fileCount, folderCount } = counts;
  let label: string;
  if (fileCount > 0 && folderCount > 0) {
    label = t("explorer.drag.overlay.breakdown", {
      files:
        fileCount === 1
          ? t("selection.fileUnit.one")
          : t("selection.fileUnit.many", { count: String(fileCount) }),
      folders:
        folderCount === 1
          ? t("selection.folderUnit.one")
          : t("selection.folderUnit.many", { count: String(folderCount) }),
    });
  } else if (folderCount > 0) {
    label = t("explorer.drag.overlay.folders", { count: String(folderCount) });
  } else {
    label =
      fileCount === 1
        ? t("selection.fileUnit.one")
        : t("selection.fileUnit.many", { count: String(fileCount) });
  }

  return t("explorer.drag.overlay.badge", { action, label });
}
