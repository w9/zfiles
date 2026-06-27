export const PREVIEW_CONTENT_SELECTOR = "[data-preview-content]";

export function shouldClosePreviewOnBackdropClick(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object" || !("closest" in target)) {
    return false;
  }
  return (target as Element).closest(PREVIEW_CONTENT_SELECTOR) == null;
}
