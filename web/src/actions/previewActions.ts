import type { ActionDefinition } from "./types";

export type PreviewActionDeps = {
  openPreviewSheet: () => void;
};

export function createPreviewActions(
  getDeps: () => PreviewActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "preview.open-sheet",
      nameKey: "preview.openSheet.name",
      categoryKey: "preview.category",
      when: "preview.inline-available == false && selection.count >= 1",
      contexts: ["context-menu"],
      handler: async () => {
        getDeps().openPreviewSheet();
      },
    },
  ];
}
