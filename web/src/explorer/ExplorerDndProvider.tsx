import {
  DndContext,
  DragOverlay,
  PointerSensor,
  getClientRect,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { FileClipboardOperation } from "@/fileOperations/clipboard";
import {
  canDropExplorerPaths,
  destDirFromExplorerDropId,
  explorerDragOperationFromModifiers,
  formatExplorerDragOverlayText,
  resolveExplorerDragPaths,
} from "@/fileOperations/explorerDrag";
import { countSelectedFileFolders } from "@/selectionStatusText";
import type { EntrySummarySource } from "@/infoSelectionSummary";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

/** Place the tooltip to the right of the pointer (grid cards are large drag nodes). */
const OVERLAY_CURSOR_GAP_X_PX = 12;

const snapBesideCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent) {
    return transform;
  }
  const activatorCoordinates = getEventCoordinates(activatorEvent);
  if (!activatorCoordinates) {
    return transform;
  }
  const offsetX = activatorCoordinates.x - draggingNodeRect.left;
  const offsetY = activatorCoordinates.y - draggingNodeRect.top;
  return {
    ...transform,
    x: transform.x + offsetX + OVERLAY_CURSOR_GAP_X_PX,
    y: transform.y + offsetY - draggingNodeRect.height / 2,
  };
};

const OVERLAY_TOOLTIP_CLASS = cn(
  "z-50 w-max whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md pointer-events-none",
);

type ExplorerDndUi = {
  dragFadePathSet: ReadonlySet<string>;
  dropHighlightPath: string | null;
  activeDragPath: string | null;
};

const ExplorerDndUiContext = createContext<ExplorerDndUi>({
  dragFadePathSet: new Set(),
  dropHighlightPath: null,
  activeDragPath: null,
});

export function useExplorerDndUi(): ExplorerDndUi {
  return useContext(ExplorerDndUiContext);
}

export type ExplorerDndProviderProps = {
  enabled: boolean;
  selectedPaths: ReadonlySet<string>;
  entryByPath: ReadonlyMap<string, EntrySummarySource>;
  onDropPaths: (
    paths: string[],
    operation: FileClipboardOperation,
    destDir: string,
  ) => void | Promise<void>;
  children: ReactNode;
};

export default function ExplorerDndProvider({
  enabled,
  selectedPaths,
  entryByPath,
  onDropPaths,
  children,
}: ExplorerDndProviderProps) {
  const { t } = useTranslation();
  const [activePath, setActivePath] = useState<string | null>(null);
  const [dragPaths, setDragPaths] = useState<string[]>([]);
  const [operation, setOperation] = useState<FileClipboardOperation>("cut");
  const [overDestDir, setOverDestDir] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const syncOperationFromEvent = useCallback((event: {
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  }) => {
    setOperation(
      explorerDragOperationFromModifiers({
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      }),
    );
  }, []);

  useEffect(() => {
    if (activePath == null) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      syncOperationFromEvent(event);
    };
    const onPointer = (event: PointerEvent) => {
      syncOperationFromEvent(event);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("pointermove", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [activePath, syncOperationFromEvent]);

  // Suppress text I-beam over names/overlay while dragging.
  useEffect(() => {
    if (activePath == null) {
      return;
    }
    const root = document.documentElement;
    root.classList.add("explorer-dnd-dragging");
    return () => {
      root.classList.remove("explorer-dnd-dragging");
    };
  }, [activePath]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!enabled) {
        return;
      }
      const path = String(event.active.id);
      const paths = resolveExplorerDragPaths(path, selectedPaths);
      setActivePath(path);
      setDragPaths(paths);
      const activator = event.activatorEvent;
      if (
        activator &&
        "ctrlKey" in activator &&
        typeof (activator as MouseEvent).ctrlKey === "boolean"
      ) {
        syncOperationFromEvent(activator as MouseEvent);
      } else {
        setOperation("cut");
      }
    },
    [enabled, selectedPaths, syncOperationFromEvent],
  );

  const onDragOver = useCallback(
    (event: { over: { id: string | number } | null }) => {
      if (!event.over) {
        setOverDestDir(null);
        return;
      }
      setOverDestDir(destDirFromExplorerDropId(event.over.id));
    },
    [],
  );

  const clearDrag = useCallback(() => {
    setActivePath(null);
    setDragPaths([]);
    setOperation("cut");
    setOverDestDir(null);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const paths =
        dragPaths.length > 0
          ? dragPaths
          : resolveExplorerDragPaths(String(event.active.id), selectedPaths);
      const destDir = event.over
        ? destDirFromExplorerDropId(event.over.id)
        : null;
      const op = operation;
      clearDrag();
      if (destDir == null || paths.length === 0) {
        return;
      }
      if (!canDropExplorerPaths({ destDir, sourcePaths: paths, operation: op })) {
        return;
      }
      void onDropPaths(paths, op, destDir);
    },
    [clearDrag, dragPaths, onDropPaths, operation, selectedPaths],
  );

  const onDragCancel = useCallback(() => {
    clearDrag();
  }, [clearDrag]);

  const dragFadePathSet = useMemo(() => {
    if (activePath == null || operation !== "cut") {
      return new Set<string>();
    }
    return new Set(dragPaths);
  }, [activePath, dragPaths, operation]);

  const dropHighlightPath = useMemo(() => {
    if (overDestDir == null || dragPaths.length === 0) {
      return null;
    }
    return canDropExplorerPaths({
      destDir: overDestDir,
      sourcePaths: dragPaths,
      operation,
    })
      ? overDestDir
      : null;
  }, [dragPaths, operation, overDestDir]);

  const overlayText = useMemo(() => {
    if (dragPaths.length === 0) {
      return "";
    }
    return formatExplorerDragOverlayText({
      paths: dragPaths,
      operation,
      counts: countSelectedFileFolders(dragPaths, entryByPath),
      t: (key, params) =>
        t(
          key as Parameters<typeof t>[0],
          params as Record<string, string> | undefined,
        ),
    });
  }, [dragPaths, entryByPath, operation, t]);

  const ui = useMemo(
    () => ({
      dragFadePathSet,
      dropHighlightPath,
      activeDragPath: activePath,
    }),
    [activePath, dragFadePathSet, dropHighlightPath],
  );

  // Virtualized rows use CSS translateY; default transform-agnostic measuring
  // places the overlay at the untransformed layout Y (far above the cursor).
  const measuring = useMemo(
    () => ({
      draggable: { measure: getClientRect },
      droppable: { measure: getClientRect },
    }),
    [],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={measuring}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <ExplorerDndUiContext.Provider value={ui}>
        {children}
      </ExplorerDndUiContext.Provider>
      <DragOverlay
        dropAnimation={null}
        className="pointer-events-none"
        style={{ width: "auto", height: "auto" }}
        modifiers={[snapBesideCursor]}
      >
        {activePath != null && overlayText ? (
          <div className={OVERLAY_TOOLTIP_CLASS}>{overlayText}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
