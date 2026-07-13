/** How long the center zoom percentage HUD stays visible after a change. */
export const ZOOM_HUD_VISIBLE_MS = 1000;

/**
 * Updates the zoom HUD baseline when the displayed percent changes.
 * A null baseline means "not yet established" (open / slide reset) — never reveal.
 * Returns `reveal: true` only when the percent differs from an established baseline.
 */
export function nextZoomHudBaseline(
  baseline: number | null,
  percent: number,
): { baseline: number; reveal: boolean } {
  if (baseline === null) {
    return { baseline: percent, reveal: false };
  }
  if (baseline === percent) {
    return { baseline, reveal: false };
  }
  return { baseline: percent, reveal: true };
}
