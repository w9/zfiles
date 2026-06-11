import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";

export type ScoredAction = {
  action: ActionDefinition;
  score: number;
};

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
  isAvailable: (action: ActionDefinition) => boolean,
): ScoredAction[] {
  return actions
    .filter((action) => isAvailable(action))
    .flatMap((action) => {
      const candidates = [
        labels[action.nameKey] ?? action.nameKey,
        ...(action.aliasKeys?.map((key) => labels[key] ?? key) ?? []),
      ];
      const score = Math.max(...candidates.map((label) => scoreLabel(label, query)));
      if (score <= 0 && query.trim()) {
        return [];
      }
      return [{ action, score: score || 1 }];
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.action.id.localeCompare(right.action.id),
    );
}
