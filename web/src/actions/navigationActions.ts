import type { ActionDefinition } from "./types";

export type NavigationActionDeps = {
  goBack: () => void;
  goForward: () => void;
  refreshListing: () => void;
  cancelListingLoad: () => void;
  focusQuickFilter: () => void;
};

export function createNavigationActions(
  getDeps: () => NavigationActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "navigation.back",
      nameKey: "actions.navigation.back.name",
      categoryKey: "actions.navigation.category",
      when: "navigation.can-go-back == true",
      whenFailureMessageKey: "actions.whenFailure.navigationBack",
      icon: "navigation.back",
      handler: async () => {
        getDeps().goBack();
      },
    },
    {
      id: "navigation.forward",
      nameKey: "actions.navigation.forward.name",
      categoryKey: "actions.navigation.category",
      when: "navigation.can-go-forward == true",
      whenFailureMessageKey: "actions.whenFailure.navigationForward",
      icon: "navigation.forward",
      handler: async () => {
        getDeps().goForward();
      },
    },
    {
      id: "navigation.refresh",
      nameKey: "actions.navigation.refresh.name",
      categoryKey: "actions.navigation.category",
      when: "navigation.loading == false",
      icon: "navigation.refresh",
      handler: async () => {
        getDeps().refreshListing();
      },
    },
    {
      id: "navigation.cancel-load",
      nameKey: "actions.navigation.cancelLoad.name",
      categoryKey: "actions.navigation.category",
      when: "navigation.loading == true",
      icon: "navigation.cancel-load",
      handler: async () => {
        getDeps().cancelListingLoad();
      },
    },
    {
      id: "navigation.focus-quick-filter",
      nameKey: "actions.navigation.focusQuickFilter.name",
      descriptionKey: "actions.navigation.focusQuickFilter.description",
      categoryKey: "actions.navigation.category",
      when: "focus.pane == 'file-list'",
      defaultKeybinding: "Mod+F",
      icon: "navigation.focus-quick-filter",
      handler: async () => {
        getDeps().focusQuickFilter();
      },
    },
  ];
}
