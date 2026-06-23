import type { ThemeMode } from "../theme";
import type { UiMode } from "../uiMode";
import type { ActionDefinition } from "./types";

export const APPEARANCE_MENU_HIDDEN_ACTION_IDS = new Set([
  "appearance.cycle-theme",
  "appearance.set-theme",
  "appearance.cycle-ui-mode",
  "appearance.set-ui-mode",
]);

export const THEME_MENU_MODES: ThemeMode[] = ["light", "dark", "auto"];

export const UI_MODE_MENU_MODES: UiMode[] = ["mouse", "touch", "auto"];

export const THEME_MENU_LABEL_KEYS = {
  light: "theme.light",
  dark: "theme.dark",
  auto: "theme.auto",
} as const;

export const UI_MODE_MENU_LABEL_KEYS = {
  mouse: "uiMode.mouse",
  touch: "uiMode.touch",
  auto: "uiMode.auto",
} as const;

export function filterAppearanceMenuActions(items: ActionDefinition[]): ActionDefinition[] {
  return items.filter((action) => !APPEARANCE_MENU_HIDDEN_ACTION_IDS.has(action.id));
}

export function shouldRenderAppearanceModeGroups(items: ActionDefinition[]): boolean {
  return items.some((action) => APPEARANCE_MENU_HIDDEN_ACTION_IDS.has(action.id));
}
