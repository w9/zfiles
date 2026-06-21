export type UiMode = "mouse" | "touch" | "auto";

export type ResolvedUiMode = "mouse" | "touch";

export const UI_MODE_STORAGE_KEY = "zfiles-ui-mode";

export const UI_MODE_HINT_TOUCH_DISMISSED_KEY = "zfiles-ui-mode-hint-touch-dismissed";

export const UI_MODE_HINT_MOUSE_DISMISSED_KEY = "zfiles-ui-mode-hint-mouse-dismissed";

export const DEFAULT_UI_MODE: UiMode = "auto";

export function parseUiMode(value: string | null): UiMode {
  if (value === "mouse" || value === "touch" || value === "auto") {
    return value;
  }
  return DEFAULT_UI_MODE;
}

export function hasCoarsePointer(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

export function resolvedUiMode(mode: UiMode, coarsePointer: boolean): ResolvedUiMode {
  if (mode === "auto") {
    return coarsePointer ? "touch" : "mouse";
  }
  return mode;
}

export function readStoredUiMode(): UiMode {
  if (typeof localStorage === "undefined") {
    return DEFAULT_UI_MODE;
  }
  return parseUiMode(localStorage.getItem(UI_MODE_STORAGE_KEY));
}

export function applyUiMode(mode: UiMode, coarsePointer: boolean): ResolvedUiMode {
  const resolved = resolvedUiMode(mode, coarsePointer);
  document.documentElement.dataset.uiMode = resolved;
  document.documentElement.dataset.uiModeSetting = mode;
  return resolved;
}

export function storeUiMode(mode: UiMode): void {
  localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
}

export function readUiModeHintDismissed(kind: "touch" | "mouse"): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  const key =
    kind === "touch" ? UI_MODE_HINT_TOUCH_DISMISSED_KEY : UI_MODE_HINT_MOUSE_DISMISSED_KEY;
  return localStorage.getItem(key) === "1";
}

export function storeUiModeHintDismissed(kind: "touch" | "mouse"): void {
  const key =
    kind === "touch" ? UI_MODE_HINT_TOUCH_DISMISSED_KEY : UI_MODE_HINT_MOUSE_DISMISSED_KEY;
  localStorage.setItem(key, "1");
}

const UI_MODE_CYCLE: UiMode[] = ["mouse", "touch", "auto"];

export function nextUiMode(mode: UiMode): UiMode {
  const index = UI_MODE_CYCLE.indexOf(mode);
  return UI_MODE_CYCLE[(index + 1) % UI_MODE_CYCLE.length];
}
