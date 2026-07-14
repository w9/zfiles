/** Screen region for a preview-overlay chrome slot. */
export type PreviewChromeRegion = "top" | "bottom-end";

export type PreviewChromeSlot = "title" | "metadata" | "zoom" | "actions";

/**
 * Title and metadata: wrap to at most two lines with an ellipsis, and allow
 * mid-token breaks so long unbroken filenames can fill the second line.
 */
export const PREVIEW_CHROME_LABEL_WRAP_CLASS = "line-clamp-2 break-all";

/**
 * Stack above the preview media layer. Gradients and interactive chrome share
 * this layer so scrims are not painted under the image/video.
 */
export const PREVIEW_CHROME_STACK_CLASS = "z-10";

/**
 * Where each preview chrome slot is rendered.
 * Title and metadata stack full-width at the top; zoom (images only) and
 * download / open / close share a full-width bottom-end action strip
 * (zoom immediately left of Download).
 */
export function previewChromeRegion(slot: PreviewChromeSlot): PreviewChromeRegion {
  switch (slot) {
    case "title":
    case "metadata":
      return "top";
    case "zoom":
    case "actions":
      return "bottom-end";
  }
}
