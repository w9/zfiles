/** Actions that remain available while a file operation is in flight. */
const ALLOWED_DURING_OPERATION_PENDING = new Set([
  "view.open-command-palette",
  "view.toggle-dot-entries",
  "view.toggle-listing-mode",
  "view.apply-global-listing-settings",
  "selection.move-down",
  "selection.move-up",
  "selection.move-left",
  "selection.move-right",
  "selection.select-all",
  "selection.clear",
  "file.copy",
  "file.cut",
  "help.open-about",
  "help.open-keyboard-shortcuts",
  "preview.get-info",
  "viewer.preview",
]);

export function isActionAllowedDuringOperationPending(actionId: string): boolean {
  return ALLOWED_DURING_OPERATION_PENDING.has(actionId);
}

export function isActionBlockedByOperationPending(
  operationPending: boolean,
  actionId: string,
): boolean {
  return operationPending && !isActionAllowedDuringOperationPending(actionId);
}
