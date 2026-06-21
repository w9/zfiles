export const COMPACT_TOUCH_CHROME_MAX_WIDTH_PX = 480;

export function isCompactTouchChromeLayout(
  touchUi: boolean,
  viewportWidth: number,
): boolean {
  return touchUi && viewportWidth <= COMPACT_TOUCH_CHROME_MAX_WIDTH_PX;
}

export function compactTouchChromeMediaQuery(): string {
  return `(max-width: ${COMPACT_TOUCH_CHROME_MAX_WIDTH_PX}px)`;
}
