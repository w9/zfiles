import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
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
                const Icon = actionIcon(action.id);
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
        );
      })}
    </Menubar>
  );
}
