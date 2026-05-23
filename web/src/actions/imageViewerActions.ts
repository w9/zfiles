import type { ActionDefinition } from "./types";
import { getViewerBridge } from "@/viewerBridge";

export type ImageViewerActionDeps = {
  getImagePaths: () => string[];
  getCurrentPreviewPath: () => string | null;
  setPreviewPath: (path: string) => void;
  openSlideshow: (paths: string[], startPath: string | null) => void;
  runBulkAction: (actionId: string, paths: string[]) => Promise<void>;
};

const IMAGE_VIEWER_WHEN = "preview.is-image == true && focus.pane == 'preview'";

export function createImageViewerActions(
  getDeps: () => ImageViewerActionDeps,
): ActionDefinition[] {
  const bridgeHandler =
    (method: keyof import("@/viewerBridge").ViewerBridge) => async () => {
      getViewerBridge()[method]?.();
    };

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
      id: "plugin.image-thumbnailer.next-image",
      nameKey: "plugin.image-thumbnailer.actions.nextImage.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "ArrowRight",
      contexts: ["preview"],
      handler: navigateImage(1),
    },
    {
      id: "plugin.image-thumbnailer.prev-image",
      nameKey: "plugin.image-thumbnailer.actions.prevImage.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "ArrowLeft",
      contexts: ["preview"],
      handler: navigateImage(-1),
    },
    {
      id: "plugin.image-thumbnailer.zoom-in",
      nameKey: "plugin.image-thumbnailer.actions.zoomIn.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "=",
      contexts: ["preview"],
      handler: bridgeHandler("zoomIn"),
    },
    {
      id: "plugin.image-thumbnailer.zoom-out",
      nameKey: "plugin.image-thumbnailer.actions.zoomOut.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "-",
      contexts: ["preview"],
      handler: bridgeHandler("zoomOut"),
    },
    {
      id: "plugin.image-thumbnailer.fit-screen",
      nameKey: "plugin.image-thumbnailer.actions.fitScreen.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "0",
      contexts: ["preview"],
      handler: bridgeHandler("fitScreen"),
    },
    {
      id: "plugin.image-thumbnailer.actual-size",
      nameKey: "plugin.image-thumbnailer.actions.actualSize.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "1",
      contexts: ["preview"],
      handler: bridgeHandler("actualSize"),
    },
    {
      id: "plugin.image-thumbnailer.toggle-fullscreen",
      nameKey: "plugin.image-thumbnailer.actions.toggleFullscreen.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "F",
      contexts: ["preview"],
      handler: bridgeHandler("toggleFullscreen"),
    },
    {
      id: "plugin.image-thumbnailer.rotate-cw",
      nameKey: "plugin.image-thumbnailer.actions.rotateCw.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "R",
      contexts: ["preview"],
      handler: bridgeHandler("rotateCw"),
    },
    {
      id: "plugin.image-thumbnailer.toggle-exif-overlay",
      nameKey: "plugin.image-thumbnailer.actions.toggleExif.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: IMAGE_VIEWER_WHEN,
      defaultKeybinding: "I",
      contexts: ["preview"],
      handler: bridgeHandler("toggleExif"),
    },
    {
      id: "plugin.image-thumbnailer.slideshow",
      nameKey: "plugin.image-thumbnailer.actions.slideshow.name",
      categoryKey: "plugin.image-thumbnailer.category",
      when: "preview.is-image == true",
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
    {
      id: "plugin.image-thumbnailer.regenerate-thumbnails",
      nameKey: "plugin.image-thumbnailer.actions.regenerate.name",
      categoryKey: "plugin.image-thumbnailer.category",
      contexts: ["context-menu", "file-list"],
      handler: async () => {
        const deps = getDeps();
        const paths = deps.getImagePaths();
        if (paths.length === 0) {
          return;
        }
        await deps.runBulkAction("plugin.image-thumbnailer.regenerate-thumbnails", paths);
      },
    },
  ];
}
