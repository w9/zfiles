/** Syncs document chrome (html/body) with touch select-mode shell tint. */
export function applySelectionModeShell(active: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  if (active) {
    document.documentElement.dataset.selectionMode = "true";
    return;
  }
  delete document.documentElement.dataset.selectionMode;
}
