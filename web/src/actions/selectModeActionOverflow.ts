/** Touch icon button width including gap between buttons (h-11 + gap-0.5). */
export const SELECT_MODE_ACTION_SLOT_PX = 46;

export function splitActionsForToolbarOverflow<T>(
  actions: T[],
  containerWidthPx: number,
  options?: {
    reservedLeadingPx?: number;
    reservedOverflowPx?: number;
    slotPx?: number;
  },
): { visible: T[]; overflow: T[] } {
  const slotPx = options?.slotPx ?? SELECT_MODE_ACTION_SLOT_PX;
  const reservedLeadingPx = options?.reservedLeadingPx ?? 0;
  const reservedOverflowPx = options?.reservedOverflowPx ?? slotPx;

  if (actions.length === 0 || containerWidthPx <= 0) {
    return { visible: actions, overflow: [] };
  }

  const availableForActions = containerWidthPx - reservedLeadingPx;
  let maxVisible = Math.floor(availableForActions / slotPx);
  maxVisible = Math.max(0, Math.min(actions.length, maxVisible));

  if (maxVisible >= actions.length) {
    return { visible: actions, overflow: [] };
  }

  if (maxVisible === 0 && actions.length > 0) {
    return { visible: [], overflow: actions };
  }

  const needsOverflow = maxVisible < actions.length;
  if (needsOverflow) {
    const widthWithOverflow = availableForActions - reservedOverflowPx;
    maxVisible = Math.floor(widthWithOverflow / slotPx);
    maxVisible = Math.max(0, Math.min(actions.length, maxVisible));
  }

  if (maxVisible >= actions.length) {
    return { visible: actions, overflow: [] };
  }

  return {
    visible: actions.slice(0, maxVisible),
    overflow: actions.slice(maxVisible),
  };
}
