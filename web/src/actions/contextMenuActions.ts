import { actionsForContext } from "./dispatch";
import { keybindingChordForContext } from "./keybindings";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition, KeybindingDefinition } from "./types";
import type { ActionRegistry } from "./registry";
import type { MessageKey } from "@/i18n";
import type { FileEntry } from "@/backend";
import { filterDownloadablePaths } from "@/downloadPaths";
import { isImagePath } from "@/imagePaths";
import { resolveViewerPreviewPaths } from "@/slideshowPathOrder";

/** Shown on listing background only — hidden when no row is targeted. */
export const CONTEXT_MENU_REQUIRES_ROW = new Set([
  "file.rename",
  "file.copy",
  "file.cut",
  "file.delete",
  "selection.copy-paths",
  "selection.download",
]);

export type ContextMenuActionItem = {
  id: string;
  label: string;
  chord: string | null;
  variant: "default" | "destructive";
};

export function contextMenuActionLabel(
  action: ActionDefinition,
  menuContextKeys: ContextKeys,
  downloadablePaths: string[],
  t: (key: MessageKey, params?: Record<string, string>) => string,
  defaultLabel: string,
): string {
  if (action.id === "selection.copy-paths") {
    return t(
      menuContextKeys["selection.count"] === 1
        ? "actions.selection.copyPath.name"
        : "actions.selection.copyPaths.name",
    );
  }
  if (action.id === "selection.download") {
    if (downloadablePaths.length === 1) {
      return t("actions.selection.download.name");
    }
    return t("actions.selection.download.nameWithCount", {
      count: String(downloadablePaths.length),
    });
  }
  return defaultLabel;
}

export function buildContextMenuContextKeys(options: {
  baseContextKeys: ContextKeys;
  targetPath: string | null;
  selectedPaths: Set<string>;
  listingRows: Array<{ path: string; isDir: boolean }>;
}): ContextKeys {
  const { baseContextKeys, targetPath, selectedPaths, listingRows } = options;
  const previewCountForSelection = (paths: string[]) =>
    resolveViewerPreviewPaths(paths, listingRows).length;

  if (targetPath == null) {
    return {
      ...baseContextKeys,
      "selection.count": 0,
      "selection.paths": [],
      "preview.path": "",
      "preview.is-image": false,
      "viewer.preview-count": 0,
    };
  }

  if (!selectedPaths.has(targetPath)) {
    return {
      ...baseContextKeys,
      "selection.count": 1,
      "selection.paths": [targetPath],
      "preview.path": targetPath,
      "preview.is-image": isImagePath(targetPath),
      "viewer.preview-count": previewCountForSelection([targetPath]),
    };
  }

  const paths = Array.from(selectedPaths);
  return {
    ...baseContextKeys,
    "preview.path": targetPath,
    "preview.is-image": isImagePath(targetPath),
    "viewer.preview-count": previewCountForSelection(paths),
  };
}

export function resolveContextMenuActions(options: {
  registry: ActionRegistry;
  contextKeys: ContextKeys;
  entries: FileEntry[];
  keybindings: KeybindingDefinition[];
  userKeybindings: KeybindingDefinition[];
  labelForAction: (nameKey: string) => string;
  t: (key: MessageKey, params?: Record<string, string>) => string;
  targetPath: string | null;
}): ContextMenuActionItem[] {
  const {
    registry,
    contextKeys,
    entries,
    keybindings,
    userKeybindings,
    labelForAction,
    t,
    targetPath,
  } = options;

  const downloadablePaths = filterDownloadablePaths(
    contextKeys["selection.paths"],
    entries,
  );
  const menuContextKeys: ContextKeys = {
    ...contextKeys,
    "selection.file-count": downloadablePaths.length,
  };

  let actions = actionsForContext(
    registry.list(),
    "context-menu",
    menuContextKeys,
  );
  if (targetPath == null) {
    actions = actions.filter((action) => !CONTEXT_MENU_REQUIRES_ROW.has(action.id));
  }

  return actions.map((action) => {
    const chord = keybindingChordForContext(
      action.id,
      keybindings,
      menuContextKeys,
      {
        defaultKeybinding: action.defaultKeybinding,
        userBindings: userKeybindings,
      },
    );
    return {
      id: action.id,
      label: contextMenuActionLabel(
        action,
        menuContextKeys,
        downloadablePaths,
        t,
        labelForAction(action.nameKey),
      ),
      chord,
      variant: action.destructive ? "destructive" : "default",
    };
  });
}
