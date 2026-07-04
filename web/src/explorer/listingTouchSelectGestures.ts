/** What a touch long-press does, given the current select-mode state. */
export type LongPressGestureAction = "enter-select-mode" | "arm-range" | "none";

export function longPressGestureAction(options: {
  selectionMode: boolean;
  hasPath: boolean;
}): LongPressGestureAction {
  if (!options.selectionMode) {
    return "enter-select-mode";
  }
  return options.hasPath ? "arm-range" : "none";
}

/** Long-press on an unselected item adds the swept range; on a selected item it removes it. */
export type ArmedRangeMode = "add" | "subtract";

export function resolveArmedRangeMode(options: {
  baseSelection: ReadonlySet<string>;
  anchorPath: string;
}): ArmedRangeMode {
  return options.baseSelection.has(options.anchorPath) ? "subtract" : "add";
}

export function armedRangeSelection(
  base: ReadonlySet<string>,
  range: ReadonlySet<string>,
  mode: ArmedRangeMode = "add",
): Set<string> {
  const next = new Set(base);
  for (const path of range) {
    if (mode === "add") {
      next.add(path);
    } else {
      next.delete(path);
    }
  }
  return next;
}
