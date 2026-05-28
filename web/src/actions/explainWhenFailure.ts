import { evaluateWhen } from "./when";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";

const WHEN_FAILURE_KEYS: Record<string, string> = {
  "selection.count > 0": "actions.whenFailure.selectionRequired",
  "focus.pane == 'file-list'": "actions.whenFailure.focusFileList",
};

export function whenFailureMessageKey(when?: string): string | null {
  if (!when?.trim()) {
    return null;
  }
  const trimmed = when.trim();
  return WHEN_FAILURE_KEYS[trimmed] ?? null;
}

export function explainActionUnavailable(
  action: ActionDefinition,
  contextKeys: ContextKeys,
  labelForKey: (key: string) => string,
): string | null {
  if (!action.when || evaluateWhen(action.when, contextKeys)) {
    return null;
  }
  if (action.whenFailureMessageKey) {
    return labelForKey(action.whenFailureMessageKey);
  }
  const mapped = whenFailureMessageKey(action.when);
  if (mapped) {
    return labelForKey(mapped);
  }
  return labelForKey("actions.whenFailure.unavailable");
}
