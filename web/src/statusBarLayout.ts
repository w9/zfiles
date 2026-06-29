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
