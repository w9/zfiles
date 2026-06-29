/** Fixed row height — matches the tallest status badge (offline destructive pill). */
export const STATUS_BAR_ROW_HEIGHT_CLASS = "h-6 min-h-6 max-h-6";

/** Shared constraints for every status bar segment (badges and text). */
export const STATUS_BAR_SEGMENT_CLASS =
  "flex h-6 min-h-6 max-h-6 min-w-0 shrink items-center truncate leading-none";

/** Normalized badge slot so variant styling cannot grow the status bar. */
export const STATUS_BAR_BADGE_CLASS =
  "h-6 max-h-6 min-h-6 gap-1 px-2 py-0 text-sm font-normal leading-none";

export function shouldCollapseStatusBarBadges(
  compactTouchChrome: boolean,
  selectionStatusText: string | null | undefined,
  cutStatusText: string | null | undefined,
): boolean {
  if (!compactTouchChrome) {
    return false;
  }
  return Boolean(selectionStatusText || cutStatusText);
}
