import { ActionRegistry } from "./registry";
import { evaluateWhen } from "./when";
import { isActionBlockedByFrozenConnection } from "../connectionFrozenGuard";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";

export type DispatchResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "when-failed" | "handler-error"; error?: unknown };

export async function dispatchAction(
  registry: ActionRegistry,
  context: ContextKeys,
  id: string,
): Promise<DispatchResult> {
  const action = registry.get(id);
  if (!action) {
    return { ok: false, reason: "not-found" };
  }
  if (!isActionAvailable(action, context)) {
    return { ok: false, reason: "when-failed" };
  }
  try {
    await action.handler(context);
    if (import.meta.env?.DEV) {
      console.debug("[actions] dispatched", id);
    }
    return { ok: true };
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.debug("[actions] handler error", id, error);
    }
    return { ok: false, reason: "handler-error", error };
  }
}

export function isActionAvailable(
  action: ActionDefinition,
  context: ContextKeys,
): boolean {
  if (isActionBlockedByFrozenConnection(context["connection.frozen"], action.id)) {
    return false;
  }
  return evaluateWhen(action.when, context);
}

export function actionsForContext(
  actions: ActionDefinition[],
  contextName: string,
  context: ContextKeys,
): ActionDefinition[] {
  return actions.filter((action) => {
    if (!action.contexts?.includes(contextName)) {
      return false;
    }
    return isActionAvailable(action, context);
  });
}
