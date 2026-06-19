import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ChordKbd from "./ChordKbd";
import { isActionAvailable } from "./dispatch";
import { actionIcon } from "./icons";
import { keybindingForAction } from "./keybindings";
import { MENU_CATEGORIES } from "./surfaces";
import type { ActionRegistry } from "./registry";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";
import type { KeybindingDefinition } from "./types";

type MenuBarProps = {
  registry: ActionRegistry;
  contextKeys: ContextKeys;
  keybindings: KeybindingDefinition[];
  labelForKey: (key: string) => string;
  invoke: (id: string) => void;
  ariaLabel: string;
};

type CategoryMenu = {
  categoryKey: string;
  items: ActionDefinition[];
};

function menuItemChord(
  action: ActionDefinition,
  keybindings: KeybindingDefinition[],
): string | null {
  return keybindingForAction(action.id, keybindings, action.defaultKeybinding);
}

function menuItemsForCategory(
  actions: ActionDefinition[],
  categoryKey: string,
  contextKeys: ContextKeys,
): ActionDefinition[] {
  return actions.filter((action) => {
    if (action.categoryKey !== categoryKey || !isActionAvailable(action, contextKeys)) {
      return false;
    }
    return true;
  });
}

function buildCategoryMenus(
  actions: ActionDefinition[],
  contextKeys: ContextKeys,
): CategoryMenu[] {
  return MENU_CATEGORIES.flatMap((categoryKey) => {
    const items = menuItemsForCategory(actions, categoryKey, contextKeys);
    if (items.length === 0) {
      return [];
    }
    return [{ categoryKey, items }];
  });
}

function renderActionLabel(
  action: ActionDefinition,
  keybindings: KeybindingDefinition[],
  labelForKey: (key: string) => string,
) {
  const chord = menuItemChord(action, keybindings);
  const label = labelForKey(action.nameKey);
  const Icon = actionIcon(action.id);
  return { chord, label, Icon };
}

export default function MenuBar({
  registry,
  contextKeys,
  keybindings,
  labelForKey,
  invoke,
  ariaLabel,
}: MenuBarProps) {
  const categoryMenus = buildCategoryMenus(registry.list(), contextKeys);

  if (categoryMenus.length === 0) {
    return null;
  }

  return (
    <>
      <Menubar
        aria-label={ariaLabel}
        className="hidden h-8 border-none bg-transparent p-0 shadow-none sm:flex"
      >
        {categoryMenus.map(({ categoryKey, items }) => (
          <MenubarMenu key={categoryKey}>
            <MenubarTrigger className="h-8 px-2">
              {labelForKey(categoryKey)}
            </MenubarTrigger>
            <MenubarContent>
              {items.map((action) => {
                const { chord, label, Icon } = renderActionLabel(
                  action,
                  keybindings,
                  labelForKey,
                );
                return (
                  <MenubarItem
                    key={action.id}
                    inset={Icon == null}
                    variant={action.destructive ? "destructive" : "default"}
                    onSelect={() => invoke(action.id)}
                  >
                    {Icon ? <Icon /> : null}
                    {label}
                    {chord ? (
                      <MenubarShortcut>
                        <ChordKbd chord={chord} />
                      </MenubarShortcut>
                    ) : null}
                  </MenubarItem>
                );
              })}
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 sm:hidden"
                aria-label={ariaLabel}
              >
                <Menu className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{ariaLabel}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          {categoryMenus.map(({ categoryKey, items }) => (
            <DropdownMenuSub key={categoryKey}>
              <DropdownMenuSubTrigger>{labelForKey(categoryKey)}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {items.map((action) => {
                  const { chord, label, Icon } = renderActionLabel(
                    action,
                    keybindings,
                    labelForKey,
                  );
                  return (
                    <DropdownMenuItem
                      key={action.id}
                      inset={Icon == null}
                      variant={action.destructive ? "destructive" : "default"}
                      onSelect={() => invoke(action.id)}
                    >
                      {Icon ? <Icon /> : null}
                      {label}
                      {chord ? (
                        <DropdownMenuShortcut>
                          <ChordKbd chord={chord} />
                        </DropdownMenuShortcut>
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
