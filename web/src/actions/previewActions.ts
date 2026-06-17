import type { ActionDefinition } from "./types";

export type PreviewActionDeps = {
  openInfoDialog: () => void;
};

export function createPreviewActions(
  getDeps: () => PreviewActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "preview.get-info",
      nameKey: "preview.getInfo.name",
      categoryKey: "preview.category",
      when: "selection.count >= 1",
      defaultKeybinding: "Mod+I",
      contexts: ["context-menu", "file-list"],
      handler: async () => {
        getDeps().openInfoDialog();
      },
    },
  ];
}
