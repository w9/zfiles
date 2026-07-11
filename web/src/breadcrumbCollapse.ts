export function pathForBreadcrumbPartIndex(
  parts: string[],
  index: number,
): string {
  if (index < 0 || index >= parts.length) {
    return "";
  }
  return parts.slice(0, index + 1).join("/");
}

/** Max scrollLeft that aligns the path end with the visible right edge. */
export function breadcrumbPathScrollLeftMax(
  scrollWidth: number,
  clientWidth: number,
): number {
  return Math.max(0, scrollWidth - clientWidth);
}

/** Left fade when content is scrolled off to the left. */
export function breadcrumbPathShowsLeftFade(scrollLeft: number): boolean {
  return scrollLeft > 1;
}
