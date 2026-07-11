/** Screen region for a preview-overlay chrome slot. */
export type PreviewChromeRegion = "top" | "bottom-end";

export type PreviewChromeSlot = "title" | "metadata" | "zoom" | "actions";

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
