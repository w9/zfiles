import type { RefObject } from "react";

import type { ClientRect } from "@/explorer/listingMarqueeSelect";

type MarqueeOverlayProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
};

/** Paint the fixed marquee rect without a React commit. */
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

/** Always-mounted host; visibility/geometry updated imperatively during drag. */
export default function MarqueeOverlay({ overlayRef }: MarqueeOverlayProps) {
  return (
    <div
      ref={overlayRef}
      className="pointer-events-none fixed z-30 border border-primary/60 bg-primary/10"
      style={{ display: "none" }}
      aria-hidden
    />
  );
}
