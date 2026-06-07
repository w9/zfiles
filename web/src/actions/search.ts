import { evaluateWhen } from "./when";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";

export type ScoredAction = {
  action: ActionDefinition;
  score: number;
  available: boolean;
};

export function isPaletteVisible(
  action: ActionDefinition,
  contextKeys: ContextKeys,
): boolean {
  return evaluateWhen(action.paletteWhen ?? action.when, contextKeys);
}

function scoreLabel(label: string, query: string): number {
  const normalizedLabel = label.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 1;
  }
  if (normalizedLabel === normalizedQuery) {
    return 100;
  }
  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 80;
  }
  if (normalizedLabel.includes(normalizedQuery)) {
    return 50;
  }
  return 0;
}

export function searchActions(
  actions: ActionDefinition[],
  query: string,
  labels: Record<string, string>,
  contextKeys: ContextKeys,
  isAvailable: (action: ActionDefinition) => boolean,
): ScoredAction[] {
  const scored = actions
    .filter(
      (action) =>
        isAvailable(action) ||
        (action.paletteWhen != null && isPaletteVisible(action, contextKeys)),
    )
    .flatMap((action) => {
      const candidates = [
        labels[action.nameKey] ?? action.nameKey,
        ...(action.aliasKeys?.map((key) => labels[key] ?? key) ?? []),
      ];
      const score = Math.max(...candidates.map((label) => scoreLabel(label, query)));
      if (score <= 0 && query.trim()) {
        return [];
      }
      const available = isAvailable(action);
      return [
        {
          action,
          score: (score || 1) * (available ? 1 : 0.5),
          available,
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(right.available) - Number(left.available) ||
        right.score - left.score ||
        left.action.id.localeCompare(right.action.id),
    );
  return scored;
}
