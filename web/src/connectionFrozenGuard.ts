/**
 * When a connection fails mid-session the explorer keeps showing the last listing it
 * loaded, so anything that would touch storage or navigate to unseen data is disabled.
 * Appearance, settings, help, and connection actions stay available.
 */
const ALLOWED_WHILE_FROZEN = new Set([
  "view.open-command-palette",
  "view.toggle-dot-entries",
  "view.toggle-listing-mode",
  "view.apply-global-listing-settings",
  "view.reset-grid-card-size",
  "appearance.cycle-theme",
  "appearance.cycle-ui-mode",
  "appearance.set-locale",
  "appearance.set-theme",
  "appearance.set-ui-mode",
  "help.open-about",
  "help.open-keyboard-shortcuts",
  "navigation.open-settings",
  "navigation.focus-quick-filter",
  "connection.switch",
  "connection.create",
  "connection.share-url",
  "selection.move-down",
  "selection.move-up",
  "selection.move-left",
  "selection.move-right",
  "selection.select-all",
  "selection.clear",
  "selection.toggle",
  "selection.toggle-mode",
  "selection.copy-paths",
]);

export function isActionAllowedWhileFrozen(actionId: string): boolean {
  return ALLOWED_WHILE_FROZEN.has(actionId);
}

export function isActionBlockedByFrozenConnection(
  frozen: boolean,
  actionId: string,
): boolean {
  return frozen && !isActionAllowedWhileFrozen(actionId);
}
