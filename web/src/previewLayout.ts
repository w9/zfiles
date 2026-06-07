export const PREVIEW_PANEL_WIDTH_PX = 650;

/** Max share of main content width the inline panel may occupy. */
export const PREVIEW_INLINE_MAX_CONTENT_FRACTION = 0.4;

/** Tailwind `lg` breakpoint — inline preview requires this viewport width. */
export const LG_BREAKPOINT_PX = 1024;

export function canShowInlinePreviewPanel(
  mainContentWidthPx: number,
  viewportWidthPx: number,
): boolean {
  if (viewportWidthPx < LG_BREAKPOINT_PX) {
    return false;
  }
  return (
    PREVIEW_PANEL_WIDTH_PX <=
    mainContentWidthPx * PREVIEW_INLINE_MAX_CONTENT_FRACTION
  );
}
