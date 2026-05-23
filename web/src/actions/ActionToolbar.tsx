import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isActionAvailable } from "./dispatch";
import { explainActionUnavailable } from "./explainWhenFailure";
import { actionIcon } from "./icons";
import KeybindingKbd from "./KeybindingKbd";
import { keybindingForAction } from "./keybindings";
import { DEFAULT_TOOLBAR_ACTIONS } from "./surfaces";
import type { ActionRegistry } from "./registry";
import type { ContextKeys } from "./contextKeys";
import type { KeybindingDefinition } from "./types";

type ActionToolbarProps = {
  registry: ActionRegistry;
  contextKeys: ContextKeys;
  keybindings: KeybindingDefinition[];
  labelForKey: (key: string) => string;
  invoke: (id: string) => void;
  ariaLabel: string;
};

export default function ActionToolbar({
  registry,
  contextKeys,
  keybindings,
  labelForKey,
  invoke,
  ariaLabel,
}: ActionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={ariaLabel}>
      {DEFAULT_TOOLBAR_ACTIONS.map((actionId) => {
        const action = registry.get(actionId);
        if (!action) {
          return null;
        }
        const available = isActionAvailable(action, contextKeys);
        const Icon = actionIcon(actionId);
        const label = labelForKey(action.nameKey);
        const chord = keybindingForAction(
          action.id,
          keybindings,
          action.defaultKeybinding,
        );
        const unavailableReason = explainActionUnavailable(action, contextKeys, labelForKey);
        return (
          <Tooltip key={actionId}>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("h-8 w-8", !available && "opacity-50")}
                  disabled={!available}
                  aria-label={label}
                  onClick={() => invoke(actionId)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex max-w-xs flex-col gap-1">
              <span className="flex items-center gap-2">
                {label}
                {chord ? <KeybindingKbd chord={chord} className="ml-0" /> : null}
              </span>
              {!available && unavailableReason ? (
                <span className="text-background/80">{unavailableReason}</span>
              ) : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
