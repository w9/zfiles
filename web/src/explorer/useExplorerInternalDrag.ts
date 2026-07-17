import { useCallback, useRef, useState } from "react";

import type { FileClipboardOperation } from "@/fileOperations/clipboard";
import {
  canDropExplorerPaths,
  dragEventHasExplorerPaths,
  dropEffectForExplorerOperation,
  explorerDragOperationFromModifiers,
  readExplorerDragPaths,
  resolveExplorerDragPaths,
  setExplorerDragData,
} from "@/fileOperations/explorerDrag";
import { basename } from "@/fileOperations/paths";
import type { MessageKey } from "@/i18n";

type UseExplorerInternalDragOptions = {
  enabled: boolean;
  selectedPaths: ReadonlySet<string>;
  formatDragLabel: (paths: readonly string[]) => string;
  onDropPaths: (
    paths: string[],
    operation: FileClipboardOperation,
    destDir: string,
  ) => void | Promise<void>;
};

function modifiersFromDragEvent(event: {
  ctrlKey: boolean;
  altKey: boolean;
}): { ctrlKey: boolean; altKey: boolean } {
  return { ctrlKey: event.ctrlKey, altKey: event.altKey };
}

function operationFromDragEvent(event: {
  ctrlKey: boolean;
  altKey: boolean;
}): FileClipboardOperation {
  return explorerDragOperationFromModifiers(modifiersFromDragEvent(event));
}

export function useExplorerInternalDrag({
  enabled,
  selectedPaths,
  formatDragLabel,
  onDropPaths,
}: UseExplorerInternalDragOptions) {
  const [dropHighlightPath, setDropHighlightPath] = useState<string | null>(null);
  const sessionPathsRef = useRef<string[] | null>(null);
  const dragImageElRef = useRef<HTMLDivElement | null>(null);
  const onDropPathsRef = useRef(onDropPaths);
  onDropPathsRef.current = onDropPaths;
  const formatDragLabelRef = useRef(formatDragLabel);
  formatDragLabelRef.current = formatDragLabel;
  const selectedPathsRef = useRef(selectedPaths);
  selectedPathsRef.current = selectedPaths;

  const clearDragImage = useCallback(() => {
    dragImageElRef.current?.remove();
    dragImageElRef.current = null;
  }, []);

  const endSession = useCallback(() => {
    sessionPathsRef.current = null;
    setDropHighlightPath(null);
    clearDragImage();
  }, [clearDragImage]);

  const onEntryDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, path: string) => {
      if (!enabled) {
        event.preventDefault();
        return;
      }
      const paths = resolveExplorerDragPaths(path, selectedPathsRef.current);
      if (paths.length === 0 || !event.dataTransfer) {
        event.preventDefault();
        return;
      }
      sessionPathsRef.current = paths;
      setExplorerDragData(event.dataTransfer, paths);
      event.dataTransfer.effectAllowed = "copyMove";

      clearDragImage();
      const label = formatDragLabelRef.current(paths);
      const el = document.createElement("div");
      el.textContent = label;
      el.style.cssText = [
        "position:absolute",
        "top:-1000px",
        "left:-1000px",
        "padding:4px 10px",
        "border-radius:6px",
        "background:color-mix(in oklab, CanvasText 88%, transparent)",
        "color:Canvas",
        "font:12px/1.3 system-ui,sans-serif",
        "white-space:nowrap",
        "pointer-events:none",
        "z-index:9999",
      ].join(";");
      document.body.appendChild(el);
      dragImageElRef.current = el;
      event.dataTransfer.setDragImage(el, 16, 12);
    },
    [enabled, clearDragImage],
  );

  const onEntryDragEnd = useCallback(() => {
    endSession();
  }, [endSession]);

  const updateHighlight = useCallback(
    (destDir: string | null, event: React.DragEvent, isDirTarget: boolean) => {
      const paths = sessionPathsRef.current;
      if (!enabled || !paths || !isDirTarget || destDir == null) {
        setDropHighlightPath(null);
        return false;
      }
      const operation = operationFromDragEvent(event);
      const ok = canDropExplorerPaths({ destDir, sourcePaths: paths, operation });
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = ok
          ? dropEffectForExplorerOperation(operation)
          : "none";
      }
      setDropHighlightPath(ok ? destDir : null);
      return ok;
    },
    [enabled],
  );

  const onFolderDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, destDir: string, isDir: boolean) => {
      if (!enabled) {
        return;
      }
      if (
        !sessionPathsRef.current &&
        !dragEventHasExplorerPaths(event.dataTransfer?.types)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      updateHighlight(destDir, event, isDir);
    },
    [enabled, updateHighlight],
  );

  const onFolderDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>, destDir: string) => {
      const related = event.relatedTarget;
      if (
        related instanceof Node &&
        event.currentTarget.contains(related)
      ) {
        return;
      }
      setDropHighlightPath((current) => (current === destDir ? null : current));
    },
    [],
  );

  const onFolderDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, destDir: string, isDir: boolean) => {
      if (!enabled || !isDir) {
        return;
      }
      const fromTransfer = event.dataTransfer
        ? readExplorerDragPaths(event.dataTransfer)
        : null;
      const paths = fromTransfer ?? sessionPathsRef.current;
      if (!paths || paths.length === 0) {
        return;
      }
      if (
        !dragEventHasExplorerPaths(event.dataTransfer?.types) &&
        !sessionPathsRef.current
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const operation = operationFromDragEvent(event);
      const ok = canDropExplorerPaths({ destDir, sourcePaths: paths, operation });
      endSession();
      if (!ok) {
        return;
      }
      void onDropPathsRef.current(paths, operation, destDir);
    },
    [enabled, endSession],
  );

  const onBreadcrumbDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, destDir: string) => {
      onFolderDragOver(event, destDir, true);
    },
    [onFolderDragOver],
  );

  const onBreadcrumbDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>, destDir: string) => {
      onFolderDragLeave(event, destDir);
    },
    [onFolderDragLeave],
  );

  const onBreadcrumbDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, destDir: string) => {
      onFolderDrop(event, destDir, true);
    },
    [onFolderDrop],
  );

  return {
    dropHighlightPath,
    onEntryDragStart,
    onEntryDragEnd,
    onFolderDragOver,
    onFolderDragLeave,
    onFolderDrop,
    onBreadcrumbDragOver,
    onBreadcrumbDragLeave,
    onBreadcrumbDrop,
  };
}

export function defaultExplorerDragLabel(
  paths: readonly string[],
  t: (key: MessageKey, params?: Record<string, string>) => string,
): string {
  if (paths.length === 1) {
    return t("explorer.drag.one", { name: basename(paths[0] ?? "") });
  }
  return t("explorer.drag.many", { count: String(paths.length) });
}
