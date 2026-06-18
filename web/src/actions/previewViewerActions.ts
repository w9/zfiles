import type { ActionDefinition } from "./types";

export type PreviewViewerActionDeps = {
  getPreviewPaths: () => string[];
  getCurrentPreviewPath: () => string | null;
  openPreview: (paths: string[], startPath: string | null) => void;
};

export function createPreviewViewerActions(
  getDeps: () => PreviewViewerActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "viewer.preview",
      nameKey: "viewer.preview.name",
      categoryKey: "viewer.category",
      when: "viewer.preview-count > 0",
      defaultKeybinding: "Space",
      contexts: ["context-menu", "file-list"],
      handler: async () => {
        const deps = getDeps();
        const paths = deps.getPreviewPaths();
        if (paths.length === 0) {
          return;
        }
        deps.openPreview(paths, deps.getCurrentPreviewPath());
      },
    },
  ];
}
