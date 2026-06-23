import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThemeMode } from "../theme";
import type { UiMode } from "../uiMode";
import {
  filterAppearanceMenuActions,
  shouldRenderAppearanceModeGroups,
  THEME_MENU_LABEL_KEYS,
  THEME_MENU_MODES,
  UI_MODE_MENU_LABEL_KEYS,
  UI_MODE_MENU_MODES,
} from "./appearanceMenu";
import ChordKbd from "./ChordKbd";
import { isActionAvailable } from "./dispatch";
import { actionIcon } from "./icons";
import { keybindingForAction } from "./keybindings";
import { MENU_CATEGORIES } from "./surfaces";
import type { ActionRegistry } from "./registry";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";
import type { KeybindingDefinition } from "./types";

export type MenuInvokeOptions = {
  args?: Record<string, unknown>;
};

type MenuBarProps = {
  registry: ActionRegistry;
  contextKeys: ContextKeys;
  keybindings: KeybindingDefinition[];
  labelForKey: (key: string) => string;
  invoke: (id: string, options?: MenuInvokeOptions) => void;
  ariaLabel: string;
  themeMode?: ThemeMode;
  uiMode?: UiMode;
  /** When true, always show the hamburger menu and hide the desktop menubar. */
  mobileMenuOnly?: boolean;
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

type AppearanceModeMenuProps = {
  themeMode: ThemeMode;
  uiMode: UiMode;
  labelForKey: (key: string) => string;
  invoke: (id: string, options?: MenuInvokeOptions) => void;
  variant: "menubar" | "dropdown";
};

function AppearanceModeMenuItems({
  themeMode,
  uiMode,
  labelForKey,
  invoke,
  variant,
}: AppearanceModeMenuProps) {
  const Label = variant === "menubar" ? MenubarLabel : DropdownMenuLabel;
  const Separator = variant === "menubar" ? MenubarSeparator : DropdownMenuSeparator;
  const CheckboxItem = variant === "menubar" ? MenubarCheckboxItem : DropdownMenuCheckboxItem;

  const selectTheme = (mode: ThemeMode) => {
    if (themeMode === mode) {
      return;
    }
    invoke("appearance.set-theme", { args: { mode } });
  };

  const selectUiMode = (mode: UiMode) => {
    if (uiMode === mode) {
      return;
    }
    invoke("appearance.set-ui-mode", { args: { mode } });
  };

  return (
    <>
      <Label>{labelForKey("theme.group")}</Label>
      {THEME_MENU_MODES.map((mode) => (
        <CheckboxItem
          key={mode}
          checked={themeMode === mode}
          onSelect={(event) => {
            if (themeMode === mode) {
              event.preventDefault();
              return;
            }
            selectTheme(mode);
          }}
        >
          {labelForKey(THEME_MENU_LABEL_KEYS[mode])}
        </CheckboxItem>
      ))}
      <Separator />
      <Label>{labelForKey("uiMode.group")}</Label>
      {UI_MODE_MENU_MODES.map((mode) => (
        <CheckboxItem
          key={mode}
          checked={uiMode === mode}
          onSelect={(event) => {
            if (uiMode === mode) {
              event.preventDefault();
              return;
            }
            selectUiMode(mode);
          }}
        >
          {labelForKey(UI_MODE_MENU_LABEL_KEYS[mode])}
        </CheckboxItem>
      ))}
    </>
  );
}

function renderCategoryItems({
  categoryKey,
  items,
  themeMode,
  uiMode,
  keybindings,
  labelForKey,
  invoke,
  variant,
}: {
  categoryKey: string;
  items: ActionDefinition[];
  themeMode?: ThemeMode;
  uiMode?: UiMode;
  keybindings: KeybindingDefinition[];
  labelForKey: (key: string) => string;
  invoke: (id: string, options?: MenuInvokeOptions) => void;
  variant: "menubar" | "dropdown";
}) {
  const isAppearanceCategory = categoryKey === "actions.appearance.category";
  const showAppearanceModeGroups =
    isAppearanceCategory &&
    themeMode != null &&
    uiMode != null &&
    shouldRenderAppearanceModeGroups(items);
  const visibleItems = showAppearanceModeGroups
    ? filterAppearanceMenuActions(items)
    : items;

  const Item = variant === "menubar" ? MenubarItem : DropdownMenuItem;
  const Shortcut = variant === "menubar" ? MenubarShortcut : DropdownMenuShortcut;
  const Separator = variant === "menubar" ? MenubarSeparator : DropdownMenuSeparator;

  return (
    <>
      {showAppearanceModeGroups ? (
        <AppearanceModeMenuItems
          themeMode={themeMode}
          uiMode={uiMode}
          labelForKey={labelForKey}
          invoke={invoke}
          variant={variant}
        />
      ) : null}
      {showAppearanceModeGroups && visibleItems.length > 0 ? <Separator /> : null}
      {visibleItems.map((action) => {
        const { chord, label, Icon } = renderActionLabel(action, keybindings, labelForKey);
        return (
          <Item
            key={action.id}
            inset={Icon == null}
            variant={action.destructive ? "destructive" : "default"}
            onSelect={() => invoke(action.id)}
          >
            {Icon ? <Icon /> : null}
            {label}
            {chord ? (
              <Shortcut>
                <ChordKbd chord={chord} />
              </Shortcut>
            ) : null}
          </Item>
        );
      })}
    </>
  );
}

export default function MenuBar({
  registry,
  contextKeys,
  keybindings,
  labelForKey,
  invoke,
  ariaLabel,
  themeMode,
  uiMode,
  mobileMenuOnly = false,
}: MenuBarProps) {
  const categoryMenus = buildCategoryMenus(registry.list(), contextKeys);

  if (categoryMenus.length === 0) {
    return null;
  }

  return (
    <>
      <Menubar
        aria-label={ariaLabel}
        className={cn(
          "h-8 border-none bg-transparent p-0 shadow-none",
          mobileMenuOnly ? "hidden" : "hidden md:flex",
        )}
      >
        {categoryMenus.map(({ categoryKey, items }) => (
          <MenubarMenu key={categoryKey}>
            <MenubarTrigger className="h-8 px-2">
              {labelForKey(categoryKey)}
            </MenubarTrigger>
            <MenubarContent>
              {renderCategoryItems({
                categoryKey,
                items,
                themeMode,
                uiMode,
                keybindings,
                labelForKey,
                invoke,
                variant: "menubar",
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
                className={cn(
                  "size-7 shrink-0 touch-ui:h-11 touch-ui:w-11",
                  mobileMenuOnly ? "flex" : "md:hidden",
                )}
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
                {renderCategoryItems({
                  categoryKey,
                  items,
                  themeMode,
                  uiMode,
                  keybindings,
                  labelForKey,
                  invoke,
                  variant: "dropdown",
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
