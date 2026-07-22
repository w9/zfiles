import type { RefObject } from "react";

import type { ClientRect } from "@/explorer/listingMarqueeSelect";

type MarqueeOverlayProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
};

/** Paint the viewport-local marquee rect without a React commit. */
export function paintMarqueeOverlay(
  el: HTMLElement | null,
  rect: ClientRect | null,
): void {
  if (!el) {
    return;
  }
  if (!rect) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.right - rect.left}px`;
  el.style.height = `${rect.bottom - rect.top}px`;
}

/**
 * Clipped host for the listing viewport. Mount as an absolute sibling of the
 * scroll element (not inside scrolling content) so geometry stays viewport-local.
 */
export default function MarqueeOverlay({ overlayRef }: MarqueeOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-hidden
    >
      <div
        ref={overlayRef}
        className="absolute border border-primary/60 bg-primary/10"
        style={{ display: "none" }}
      />
    </div>
  );
}
