import { pointerDistance } from "@/explorer/listingMarqueeSelect";

export const LISTING_LONG_PRESS_MS = 500;

export const LISTING_LONG_PRESS_MOVE_THRESHOLD_PX = 10;

export type ContextMenuPointerEvent = {
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};

export function shouldHandleListingLongPress(options: {
  enabled: boolean;
  touchUi: boolean;
  pointerType: string;
}): boolean {
  return options.enabled && options.touchUi && options.pointerType === "touch";
}

export function shouldCancelLongPressOnMove(options: {
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  thresholdPx?: number;
}): boolean {
  return (
    pointerDistance(
      options.startX,
      options.startY,
      options.clientX,
      options.clientY,
    ) >= (options.thresholdPx ?? LISTING_LONG_PRESS_MOVE_THRESHOLD_PX)
  );
}

export function listingEntryPathFromTarget(target: EventTarget | null): string | null {
  if (
    target == null ||
    typeof target !== "object" ||
    typeof (target as Element).closest !== "function"
  ) {
    return null;
  }
  const entry = (target as Element).closest("[data-listing-entry]");
  if (!entry) {
    return null;
  }
  return entry.getAttribute("data-listing-path");
}

export function isListingEntryPointerTarget(target: EventTarget | null): boolean {
  return listingEntryPathFromTarget(target) != null;
}
