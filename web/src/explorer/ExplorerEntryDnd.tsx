import {
  useDraggable,
  useDroppable,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { Slot } from "@radix-ui/react-slot";
import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  EXPLORER_DRAG_HANDLE_ATTR,
  EXPLORER_DRAG_SURFACE_ATTR,
  explorerDropIdForDir,
} from "@/fileOperations/explorerDrag";
import { cn } from "@/lib/utils";

const FOLDER_DROP_HIGHLIGHT_CLASS =
  "rounded-sm bg-primary/20 ring-2 ring-inset ring-primary/50";

type EntryDragContextValue = {
  enabled: boolean;
  isSelected: boolean;
  listeners: DraggableSyntheticListeners | undefined;
  attributes: DraggableAttributes;
};

const EntryDragContext = createContext<EntryDragContextValue | null>(null);

function mergeRefs(
  ...refs: Array<((node: HTMLElement | null) => void) | undefined>
) {
  return (node: HTMLElement | null) => {
    for (const ref of refs) {
      ref?.(node);
    }
  };
}

export function ExplorerEntryDragSource({
  path,
  isDir,
  isSelected,
  enabled,
  dropHighlight,
  children,
}: {
  path: string;
  isDir: boolean;
  isSelected: boolean;
  enabled: boolean;
  /** External highlight when this folder is a valid drop over target. */
  dropHighlight?: boolean;
  children: (api: {
    setNodeRef: (node: HTMLElement | null) => void;
    isDragging: boolean;
    isDropTarget: boolean;
    /** When selected, spread on the selection chrome so it owns the drag gesture. */
    surfaceProps: Record<string, unknown>;
  }) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: path,
    disabled: !enabled,
    data: { kind: "entry" as const, path },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: explorerDropIdForDir(path),
    disabled: !enabled || !isDir,
    data: { kind: "folder" as const, path },
  });

  const isDropTarget = Boolean(dropHighlight || (isOver && isDir));

  const surfaceProps =
    enabled && isSelected
      ? {
          [EXPLORER_DRAG_SURFACE_ATTR]: "",
          ...listeners,
          ...attributes,
        }
      : {};

  return (
    <EntryDragContext.Provider
      value={{ enabled, isSelected, listeners, attributes }}
    >
      {children({
        setNodeRef: mergeRefs(setDragRef, setDropRef),
        isDragging,
        isDropTarget,
        surfaceProps,
      })}
    </EntryDragContext.Provider>
  );
}

/**
 * Icon / filename activator when unselected. When selected, the entry surface
 * owns listeners; handles are still marked so marquee stays off them.
 */
export function ExplorerDragHandle({
  className,
  style,
  role,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  role?: string;
  children: ReactNode;
}) {
  const ctx = useContext(EntryDragContext);
  const handleAttr = { [EXPLORER_DRAG_HANDLE_ATTR]: "" };
  if (!ctx?.enabled) {
    return (
      <div className={className} style={style} role={role}>
        {children}
      </div>
    );
  }

  if (ctx.isSelected) {
    return (
      <div className={className} style={style} role={role} {...handleAttr}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={style}
      {...handleAttr}
      {...ctx.listeners}
      {...ctx.attributes}
      role={role ?? ctx.attributes.role}
    >
      {children}
    </div>
  );
}

export function ExplorerFolderDropTarget({
  path,
  disabled,
  highlight,
  className,
  asChild = false,
  children,
}: {
  path: string;
  disabled?: boolean;
  /** Prefer provider-validated highlight over raw isOver. */
  highlight?: boolean;
  className?: string;
  /** Merge droppable onto the child (avoid wrapper + child double chrome). */
  asChild?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: explorerDropIdForDir(path),
    disabled,
    data: { kind: "folder" as const, path },
  });

  const showHighlight = Boolean(highlight ?? isOver);
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      ref={setNodeRef}
      className={cn(className, showHighlight && FOLDER_DROP_HIGHLIGHT_CLASS)}
    >
      {children}
    </Comp>
  );
}
