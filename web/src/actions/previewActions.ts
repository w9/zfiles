import type { ActionDefinition } from "./types";

export type PreviewActionDeps = {
  toggleInfoDialog: () => void;
};

export function createPreviewActions(
  getDeps: () => PreviewActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "preview.get-info",
      nameKey: "preview.getInfo.name",
      categoryKey: "preview.category",
      defaultKeybinding: "Mod+I",
      contexts: ["context-menu", "file-list"],
      handler: async () => {
        getDeps().toggleInfoDialog();
      },
    },
  ];
}
