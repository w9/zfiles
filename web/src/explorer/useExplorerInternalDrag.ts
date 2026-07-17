import { useCallback, useRef, useState } from "react";

import type { FileClipboardOperation } from "@/fileOperations/clipboard";
import {
  canDropExplorerPaths,
  canStartExplorerEntryDrag,
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
  formatDragLabel: (
    paths: readonly string[],
    operation: FileClipboardOperation,
  ) => string;
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

function operationFromKeyboardEvent(event: KeyboardEvent): FileClipboardOperation {
  return explorerDragOperationFromModifiers({
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
  });
}

const DRAG_BADGE_STYLE = [
  "position:fixed",
  "top:0",
  "left:0",
  "padding:4px 10px",
  "border-radius:6px",
  "background:color-mix(in oklab, CanvasText 88%, transparent)",
  "color:Canvas",
  "font:12px/1.3 system-ui,sans-serif",
  "white-space:nowrap",
  "pointer-events:none",
  "z-index:9999",
  "transform:translate(-9999px,-9999px)",
].join(";");

export function useExplorerInternalDrag({
  enabled,
  selectedPaths,
  formatDragLabel,
  onDropPaths,
}: UseExplorerInternalDragOptions) {
  const [dropHighlightPath, setDropHighlightPath] = useState<string | null>(null);
  const sessionPathsRef = useRef<string[] | null>(null);
  const sessionOperationRef = useRef<FileClipboardOperation>("cut");
  const dragBadgeElRef = useRef<HTMLDivElement | null>(null);
  const dragListenersCleanupRef = useRef<(() => void) | null>(null);
  const onDropPathsRef = useRef(onDropPaths);
  onDropPathsRef.current = onDropPaths;
  const formatDragLabelRef = useRef(formatDragLabel);
  formatDragLabelRef.current = formatDragLabel;
  const selectedPathsRef = useRef(selectedPaths);
  selectedPathsRef.current = selectedPaths;

  const updateBadgeLabel = useCallback((operation: FileClipboardOperation) => {
    const paths = sessionPathsRef.current;
    const el = dragBadgeElRef.current;
    if (!paths || !el) {
      return;
    }
    sessionOperationRef.current = operation;
    el.textContent = formatDragLabelRef.current(paths, operation);
  }, []);

  const positionBadge = useCallback((clientX: number, clientY: number) => {
    const el = dragBadgeElRef.current;
    if (!el) {
      return;
    }
    el.style.transform = `translate(${clientX + 14}px, ${clientY + 14}px)`;
  }, []);

  const clearDragBadge = useCallback(() => {
    dragListenersCleanupRef.current?.();
    dragListenersCleanupRef.current = null;
    dragBadgeElRef.current?.remove();
    dragBadgeElRef.current = null;
  }, []);

  const endSession = useCallback(() => {
    sessionPathsRef.current = null;
    sessionOperationRef.current = "cut";
    setDropHighlightPath(null);
    clearDragBadge();
  }, [clearDragBadge]);

  const onEntryDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, path: string) => {
      if (!enabled) {
        event.preventDefault();
        return;
      }
      const isSelected = selectedPathsRef.current.has(path);
      if (!canStartExplorerEntryDrag({ target: event.target, isSelected })) {
        event.preventDefault();
        return;
      }
      const paths = resolveExplorerDragPaths(path, selectedPathsRef.current);
      if (paths.length === 0 || !event.dataTransfer) {
        event.preventDefault();
        return;
      }
      sessionPathsRef.current = paths;
      const operation = operationFromDragEvent(event);
      sessionOperationRef.current = operation;
      setExplorerDragData(event.dataTransfer, paths);
      event.dataTransfer.effectAllowed = "copyMove";

      clearDragBadge();
      const el = document.createElement("div");
      el.textContent = formatDragLabelRef.current(paths, operation);
      el.style.cssText = DRAG_BADGE_STYLE;
      document.body.appendChild(el);
      dragBadgeElRef.current = el;
      // Transparent drag image so the live badge is the only visual.
      const blank = document.createElement("canvas");
      blank.width = 1;
      blank.height = 1;
      event.dataTransfer.setDragImage(blank, 0, 0);
      positionBadge(event.clientX, event.clientY);

      const onDragOver = (moveEvent: DragEvent) => {
        if (!sessionPathsRef.current) {
          return;
        }
        positionBadge(moveEvent.clientX, moveEvent.clientY);
        updateBadgeLabel(operationFromDragEvent(moveEvent));
      };
      const onKeyChange = (keyEvent: KeyboardEvent) => {
        if (!sessionPathsRef.current) {
          return;
        }
        updateBadgeLabel(operationFromKeyboardEvent(keyEvent));
      };
      window.addEventListener("dragover", onDragOver);
      window.addEventListener("keydown", onKeyChange);
      window.addEventListener("keyup", onKeyChange);
      dragListenersCleanupRef.current = () => {
        window.removeEventListener("dragover", onDragOver);
        window.removeEventListener("keydown", onKeyChange);
        window.removeEventListener("keyup", onKeyChange);
      };
    },
    [enabled, clearDragBadge, positionBadge, updateBadgeLabel],
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
      updateBadgeLabel(operation);
      positionBadge(event.clientX, event.clientY);
      const ok = canDropExplorerPaths({ destDir, sourcePaths: paths, operation });
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = ok
          ? dropEffectForExplorerOperation(operation)
          : "none";
      }
      setDropHighlightPath(ok ? destDir : null);
      return ok;
    },
    [enabled, positionBadge, updateBadgeLabel],
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
      if (related instanceof Node && event.currentTarget.contains(related)) {
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
  operation: FileClipboardOperation,
  t: (key: MessageKey, params?: Record<string, string>) => string,
): string {
  const itemLabel =
    paths.length === 1
      ? t("explorer.drag.one", { name: basename(paths[0] ?? "") })
      : t("explorer.drag.many", { count: String(paths.length) });
  const operationLabel =
    operation === "copy"
      ? t("explorer.drag.operation.copy")
      : t("explorer.drag.operation.move");
  return t("explorer.drag.badge", {
    operation: operationLabel,
    label: itemLabel,
  });
}
