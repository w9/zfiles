export type SlideshowNavDirection = "prev" | "next";

const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "h", "H", "k", "K"]);
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "j", "J", "l", "L"]);

export function slideshowNavDirection(key: string): SlideshowNavDirection | null {
  if (PREV_KEYS.has(key)) {
    return "prev";
  }
  if (NEXT_KEYS.has(key)) {
    return "next";
  }
  return null;
}

export function isSlideshowTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
