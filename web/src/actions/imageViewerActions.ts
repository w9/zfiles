import type { ActionDefinition } from "./types";

export type ImageViewerActionDeps = {
  getImagePaths: () => string[];
  getCurrentPreviewPath: () => string | null;
  setPreviewPath: (path: string) => void;
  openSlideshow: (paths: string[], startPath: string | null) => void;
};

const IMAGE_VIEWER_WHEN = "preview.is-image == true && focus.pane == 'preview'";

export function createImageViewerActions(
  getDeps: () => ImageViewerActionDeps,
): ActionDefinition[] {
  const navigateImage = (delta: number) => async () => {
    const deps = getDeps();
    const paths = deps.getImagePaths();
    const current = deps.getCurrentPreviewPath();
    if (paths.length === 0 || !current) {
      return;
    }
    const index = paths.indexOf(current);
    if (index < 0) {
      return;
    }
    const next = paths[(index + delta + paths.length) % paths.length];
    deps.setPreviewPath(next);
  };

  return [
    {
      id: "viewer.next-image",
      nameKey: "viewer.nextImage.name",
      categoryKey: "viewer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "ArrowRight",
      contexts: ["preview"],
      handler: navigateImage(1),
    },
    {
      id: "viewer.prev-image",
      nameKey: "viewer.prevImage.name",
      categoryKey: "viewer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "ArrowLeft",
      contexts: ["preview"],
      handler: navigateImage(-1),
    },
    {
      id: "viewer.slideshow",
      nameKey: "viewer.slideshow.name",
      categoryKey: "viewer.category",
      when: "preview.is-image == true",
      defaultKeybinding: "Space",
      contexts: ["context-menu", "file-list", "preview"],
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
