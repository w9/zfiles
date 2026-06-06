import type { ClientRect } from "@/explorer/listingMarqueeSelect";

type MarqueeOverlayProps = {
  rect: ClientRect | null;
};

export default function MarqueeOverlay({ rect }: MarqueeOverlayProps) {
  if (!rect) {
    return null;
  }

  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  return (
    <div
      className="pointer-events-none fixed z-30 border border-primary/60 bg-primary/10"
      style={{
        left: rect.left,
        top: rect.top,
        width,
        height,
      }}
      aria-hidden
    />
  );
}
