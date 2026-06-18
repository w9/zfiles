import type { ActionRegistry } from "./registry";
import { evaluateWhen } from "./when";
import { isActionBlockedByOperationPending } from "../operationPendingGuard";
import { resolveActionArgs } from "./args";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition } from "./types";

export type InvokeOptions = {
  args?: Record<string, unknown>;
  confirm?: boolean;
};

export type InvokeHooks = {
  confirmDestructive?: (action: ActionDefinition) => Promise<boolean>;
  promptArg?: (
    action: ActionDefinition,
    schema: NonNullable<ActionDefinition["args"]>[number],
    partial: Record<string, unknown>,
  ) => Promise<string | null>;
};

export type InvokeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not-found"
        | "when-failed"
        | "cancelled"
        | "handler-error";
      error?: unknown;
    };

export async function invokeAction(
  registry: ActionRegistry,
  context: ContextKeys,
  id: string,
  options: InvokeOptions = {},
  hooks: InvokeHooks = {},
): Promise<InvokeResult> {
  const action = registry.get(id);
  if (!action) {
    return { ok: false, reason: "not-found" };
  }
  if (!evaluateWhen(action.when, context)) {
    return { ok: false, reason: "when-failed" };
  }

  if (isActionBlockedByOperationPending(context["operation.pending"], id)) {
    return { ok: false, reason: "cancelled" };
  }

  const confirmDisabled =
    options.confirm === false || options.args?.confirm === false;
  if (action.destructive && !confirmDisabled) {
    const approved = hooks.confirmDestructive
      ? await hooks.confirmDestructive(action)
      : false;
    if (!approved) {
      return { ok: false, reason: "cancelled" };
    }
  }

  let args = { ...options.args };
  delete args.confirm;

  let { resolved, missing } = resolveActionArgs(action.args, context, args);
  while (missing.length > 0) {
    const schema = missing[0];
    if (!schema || !hooks.promptArg) {
      return { ok: false, reason: "cancelled" };
    }
    const value = await hooks.promptArg(action, schema, resolved);
    if (value == null || value.trim() === "") {
      return { ok: false, reason: "cancelled" };
    }
    resolved = { ...resolved, [schema.name]: value.trim() };
    ({ resolved, missing } = resolveActionArgs(action.args, context, resolved));
  }

  try {
    await action.handler(context, resolved);
    if (import.meta.env?.DEV) {
      console.debug("[actions] invoked", id, resolved);
    }
    return { ok: true };
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.debug("[actions] handler error", id, error);
    }
    return { ok: false, reason: "handler-error", error };
  }
}
