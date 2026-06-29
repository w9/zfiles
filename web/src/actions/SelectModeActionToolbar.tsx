import { useLayoutEffect, useRef, useState } from "react";
import { Check, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ChordKbd from "./ChordKbd";
import { actionIconWithFallback } from "./icons";
import {
  SELECT_MODE_ACTION_SLOT_PX,
  splitActionsForToolbarOverflow,
} from "./selectModeActionOverflow";
import type { ContextMenuActionItem } from "./contextMenuActions";

type SelectModeActionToolbarProps = {
  actions: ContextMenuActionItem[];
  doneLabel: string;
  overflowLabel: string;
  ariaLabel: string;
  onDone: () => void;
  invoke: (id: string) => void;
  embedded?: boolean;
  className?: string;
};

function ActionIconButton({
  action,
  onInvoke,
}: {
  action: ContextMenuActionItem;
  onInvoke: (id: string) => void;
}) {
  const Icon = actionIconWithFallback(action.id);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={action.variant === "destructive" ? "ghost" : "ghost"}
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 touch-ui:h-11 touch-ui:w-11",
            action.variant === "destructive" &&
              "text-destructive hover:text-destructive",
          )}
          aria-label={action.label}
          onClick={() => onInvoke(action.id)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex max-w-xs flex-col gap-1">
        <span className="flex items-center gap-2">
          {action.label}
          {action.chord ? <ChordKbd chord={action.chord} /> : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export default function SelectModeActionToolbar({
  actions,
  doneLabel,
  overflowLabel,
  ariaLabel,
  onDone,
  invoke,
  embedded = false,
  className,
}: SelectModeActionToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleActions, setVisibleActions] = useState(actions);
  const [overflowActions, setOverflowActions] = useState<ContextMenuActionItem[]>(
    [],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const update = () => {
      const width = container.clientWidth;
      const split = splitActionsForToolbarOverflow(actions, width, {
        reservedLeadingPx: SELECT_MODE_ACTION_SLOT_PX,
        reservedOverflowPx: SELECT_MODE_ACTION_SLOT_PX,
      });
      setVisibleActions(split.visible);
      setOverflowActions(split.overflow);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [actions]);

  const toolbar = (
    <div
      ref={containerRef}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0 touch-ui:h-11 touch-ui:w-11"
            aria-label={doneLabel}
            onClick={onDone}
          >
            <Check className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{doneLabel}</TooltipContent>
      </Tooltip>
      {visibleActions.map((action) => (
        <ActionIconButton key={action.id} action={action} onInvoke={invoke} />
      ))}
      {overflowActions.length > 0 ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 touch-ui:h-11 touch-ui:w-11"
                  aria-label={overflowLabel}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{overflowLabel}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {overflowActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                variant={action.variant === "destructive" ? "destructive" : "default"}
                onClick={() => invoke(action.id)}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );

  if (embedded) {
    return toolbar;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center" role="toolbar" aria-label={ariaLabel}>
      {toolbar}
    </div>
  );
}
