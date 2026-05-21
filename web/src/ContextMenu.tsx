import { useEffect, useRef } from "react";

export type ContextMenuAction = {
  id: string;
  label: string;
};

type ContextMenuProps = {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onSelect: (actionId: string) => void;
  onClose: () => void;
};

export default function ContextMenu({
  x,
  y,
  actions,
  onSelect,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ top: y, left: x }}
      role="menu"
      aria-label="File actions"
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onSelect(action.id);
            onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
