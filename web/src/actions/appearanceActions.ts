import { resolveLocale, type Locale } from "../i18n/messages";
import { nextThemeMode, parseThemeMode, type ThemeMode } from "../theme";
import { nextUiMode, parseUiMode, type UiMode } from "../uiMode";
import type { ActionDefinition } from "./types";

export type AppearanceActionDeps = {
  getThemeMode: () => ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  getUiMode: () => UiMode;
  setUiMode: (mode: UiMode) => void;
  getLocale: () => Locale;
  setLocale: (locale: Locale) => void;
};

export function createAppearanceActions(
  getDeps: () => AppearanceActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "appearance.cycle-theme",
      nameKey: "actions.appearance.cycleTheme.name",
      descriptionKey: "actions.appearance.cycleTheme.description",
      categoryKey: "actions.appearance.category",
      icon: "appearance.cycle-theme",
      handler: async () => {
        const deps = getDeps();
        deps.setThemeMode(nextThemeMode(deps.getThemeMode()));
      },
    },
    {
      id: "appearance.set-theme",
      nameKey: "actions.appearance.setTheme.name",
      descriptionKey: "actions.appearance.setTheme.description",
      categoryKey: "actions.appearance.category",
      args: [{ name: "mode", type: "string" }],
      handler: async (_context, args) => {
        getDeps().setThemeMode(parseThemeMode(String(args?.mode ?? null)));
      },
    },
    {
      id: "appearance.cycle-ui-mode",
      nameKey: "actions.appearance.cycleUiMode.name",
      descriptionKey: "actions.appearance.cycleUiMode.description",
      categoryKey: "actions.appearance.category",
      icon: "appearance.cycle-ui-mode",
      handler: async () => {
        const deps = getDeps();
        deps.setUiMode(nextUiMode(deps.getUiMode()));
      },
    },
    {
      id: "appearance.set-ui-mode",
      nameKey: "actions.appearance.setUiMode.name",
      descriptionKey: "actions.appearance.setUiMode.description",
      categoryKey: "actions.appearance.category",
      args: [{ name: "mode", type: "string" }],
      handler: async (_context, args) => {
        getDeps().setUiMode(parseUiMode(String(args?.mode ?? null)));
      },
    },
    {
      id: "appearance.set-locale",
      nameKey: "actions.appearance.setLocale.name",
      descriptionKey: "actions.appearance.setLocale.description",
      categoryKey: "actions.appearance.category",
      icon: "appearance.set-locale",
      args: [{ name: "locale", type: "string" }],
      handler: async (_context, args) => {
        getDeps().setLocale(resolveLocale(String(args?.locale ?? "")));
      },
    },
  ];
}
