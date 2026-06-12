import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChordKbd from "@/actions/ChordKbd";
import { actionIcon } from "@/actions/icons";

export type ContextMenuAction = {
  id: string;
  label: string;
  chord?: string | null;
  variant?: "default" | "destructive";
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
        {actions.map((action) => {
          const Icon = actionIcon(action.id);
          return (
            <DropdownMenuItem
              key={action.id}
              inset={Icon == null}
              variant={action.variant}
              onSelect={() => {
                onSelect(action.id);
                onClose();
              }}
            >
              {Icon ? <Icon /> : null}
              {action.label}
              {action.chord ? (
                <DropdownMenuShortcut>
                  <ChordKbd chord={action.chord} />
                </DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
