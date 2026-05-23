import type { ContextKeys } from "./contextKeys";
import type { ArgSchema } from "./types";

export function resolveActionArgs(
  schemas: ArgSchema[] | undefined,
  context: ContextKeys,
  provided: Record<string, unknown> = {},
): { resolved: Record<string, unknown>; missing: ArgSchema[] } {
  if (!schemas?.length) {
    return { resolved: { ...provided }, missing: [] };
  }

  const resolved: Record<string, unknown> = { ...provided };
  const missing: ArgSchema[] = [];

  for (const schema of schemas) {
    if (resolved[schema.name] !== undefined) {
      continue;
    }
    const value = resolveDefault(schema, context);
    if (value === undefined) {
      missing.push(schema);
    } else {
      resolved[schema.name] = value;
    }
  }

  return { resolved, missing };
}

function resolveDefault(schema: ArgSchema, context: ContextKeys): unknown {
  if (!schema.default) {
    return undefined;
  }
  switch (schema.default.from) {
    case "selection":
      return context["selection.paths"];
    case "selection.first":
      return context["selection.paths"][0];
    case "current-path":
      return context["current-path"];
    case "context-key":
      return schema.default.key
        ? context[schema.default.key as keyof ContextKeys]
        : undefined;
    case "value":
      return schema.default.value;
    default:
      return undefined;
  }
}
