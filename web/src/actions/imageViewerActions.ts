import type { ActionDefinition } from "./types";

export type ImageViewerActionDeps = {
  getImagePaths: () => string[];
  getCurrentPreviewPath: () => string | null;
  openSlideshow: (paths: string[], startPath: string | null) => void;
};

export function createImageViewerActions(
  getDeps: () => ImageViewerActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "viewer.slideshow",
      nameKey: "viewer.slideshow.name",
      categoryKey: "viewer.category",
      when: "viewer.image-count > 0",
      defaultKeybinding: "Space",
      contexts: ["context-menu", "file-list"],
      handler: async () => {
        const deps = getDeps();
        const paths = deps.getImagePaths();
        if (paths.length === 0) {
          return;
        }
        deps.openSlideshow(paths, deps.getCurrentPreviewPath());
      },
    },
  ];
}
