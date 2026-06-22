import type { ActionDefinition, KeybindingDefinition } from "./types";

export type ShortcutDialogRow = {
  categoryKey: string;
  actionLabel: string;
  chord: string;
};

function isUnbindChord(key: string): boolean {
  return key === "" || key.startsWith("-");
}

export function shortcutDialogRows(
  actions: ActionDefinition[],
  keybindings: KeybindingDefinition[],
  labelForKey: (key: string) => string,
): ShortcutDialogRow[] {
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const rows: ShortcutDialogRow[] = [];

  for (const binding of keybindings) {
    if (isUnbindChord(binding.key)) {
      continue;
    }
    const action = actionById.get(binding.command);
    if (!action) {
      continue;
    }
    rows.push({
      categoryKey: action.categoryKey,
      actionLabel: labelForKey(action.nameKey),
      chord: binding.key,
    });
  }

  return rows;
}

export const SHORTCUT_DIALOG_CATEGORY_ORDER = [
  "actions.view.category",
  "actions.appearance.category",
  "actions.navigation.category",
  "actions.selection.category",
  "actions.file.category",
  "viewer.category",
  "preview.category",
  "actions.cloud.category",
  "actions.help.category",
] as const;

export function groupShortcutDialogRows(
  rows: ShortcutDialogRow[],
): Array<{ categoryKey: string; rows: ShortcutDialogRow[] }> {
  const grouped = new Map<string, ShortcutDialogRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.categoryKey) ?? [];
    bucket.push(row);
    grouped.set(row.categoryKey, bucket);
  }

  const orderedKeys = [
    ...SHORTCUT_DIALOG_CATEGORY_ORDER.filter((key) => grouped.has(key)),
    ...[...grouped.keys()].filter(
      (key) => !SHORTCUT_DIALOG_CATEGORY_ORDER.includes(key as (typeof SHORTCUT_DIALOG_CATEGORY_ORDER)[number]),
    ),
  ];

  return orderedKeys.map((categoryKey) => ({
    categoryKey,
    rows: grouped.get(categoryKey) ?? [],
  }));
}
