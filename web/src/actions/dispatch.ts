import { ActionRegistry } from "./registry";
import { evaluateWhen } from "./when";
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
  if (!evaluateWhen(action.when, context)) {
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
  return evaluateWhen(action.when, context);
}

export function actionsForContext(
  actions: ActionDefinition[],
  contextName: string,
  context: ContextKeys,
): ActionDefinition[] {
  return actions.filter((action) => {
    if (action.contexts && !action.contexts.includes(contextName)) {
      return false;
    }
    return isActionAvailable(action, context);
  });
}
