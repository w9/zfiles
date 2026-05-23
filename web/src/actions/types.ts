import type { ContextKeys } from "./contextKeys";

export type ArgDefault =
  | { from: "selection" }
  | { from: "selection.first" }
  | { from: "current-path" }
  | { from: "context-key"; key: string }
  | { from: "value"; value: unknown };

export type ArgSchema = {
  name: string;
  type: "string" | "file-path" | "file-paths" | "directory-path";
  default?: ArgDefault;
};

export type ActionHandler = (
  context: ContextKeys,
  args?: Record<string, unknown>,
) => void | Promise<void>;

export type ActionDefinition = {
  id: string;
  nameKey: string;
  descriptionKey?: string;
  categoryKey: string;
  aliasKeys?: string[];
  icon?: string;
  when?: string;
  contexts?: string[];
  defaultKeybinding?: string;
  destructive?: boolean;
  confirmMessageKey?: string;
  whenFailureMessageKey?: string;
  args?: ArgSchema[];
  handler: ActionHandler;
};

export type KeybindingDefinition = {
  key: string;
  command: string;
  when?: string;
  args?: Record<string, unknown>;
};

export type PluginActionDefinition = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  when?: string;
  contexts?: string[];
  destructive?: boolean;
  defaultKeybinding?: string;
};
