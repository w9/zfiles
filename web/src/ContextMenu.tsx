import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ContextMenuAction = {
  id: string;
  label: string;
};

type ContextMenuProps = {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  ariaLabel: string;
  onSelect: (actionId: string) => void;
  onClose: () => void;
};

export default function ExplorerContextMenu({
  x,
  y,
  actions,
  ariaLabel,
  onSelect,
  onClose,
}: ContextMenuProps) {
  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <span
          className="fixed block h-px w-px"
          style={{ top: y, left: x }}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={ariaLabel}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onSelect={() => {
              onSelect(action.id);
              onClose();
            }}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
