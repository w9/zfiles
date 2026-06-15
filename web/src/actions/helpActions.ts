import type { ActionDefinition } from "./types";

export type HelpActionDeps = {
  openAbout: () => void;
  openKeyboardShortcuts: () => void;
};

export function createHelpActions(getDeps: () => HelpActionDeps): ActionDefinition[] {
  return [
    {
      id: "help.open-keyboard-shortcuts",
      nameKey: "actions.help.openKeyboardShortcuts.name",
      categoryKey: "actions.help.category",
      handler: async () => {
        getDeps().openKeyboardShortcuts();
      },
    },
    {
      id: "help.open-about",
      nameKey: "actions.help.openAbout.name",
      categoryKey: "actions.help.category",
      handler: async () => {
        getDeps().openAbout();
      },
    },
  ];
}
