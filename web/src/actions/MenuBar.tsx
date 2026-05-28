import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { isActionAvailable } from "./dispatch";
import KeybindingKbd from "./KeybindingKbd";
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

export default function MenuBar({
  registry,
  contextKeys,
  keybindings,
  labelForKey,
  invoke,
  ariaLabel,
}: MenuBarProps) {
  const actions = registry.list();

  return (
    <Menubar aria-label={ariaLabel} className="h-8 border-none bg-transparent p-0 shadow-none">
      {MENU_CATEGORIES.map((categoryKey) => {
        const items = menuItemsForCategory(actions, categoryKey, contextKeys);
        if (items.length === 0) {
          return null;
        }
        return (
          <MenubarMenu key={categoryKey}>
            <MenubarTrigger className="h-8 px-2">{labelForKey(categoryKey)}</MenubarTrigger>
            <MenubarContent>
              {items.map((action) => {
                const chord = menuItemChord(action, keybindings);
                const label = labelForKey(action.nameKey);
                return (
                  <MenubarItem key={action.id} onSelect={() => invoke(action.id)}>
                    <span className="flex-1">{label}</span>
                    {chord ? <KeybindingKbd chord={chord} className="ml-2" /> : null}
                  </MenubarItem>
                );
              })}
            </MenubarContent>
          </MenubarMenu>
        );
      })}
    </Menubar>
  );
}
