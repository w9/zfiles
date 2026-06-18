import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/api";
import type { BuiltinActionDeps } from "./builtins";
import { createBuiltinActions } from "./builtins";
import { createHelpActions, type HelpActionDeps } from "./helpActions";
import {
  createPreviewViewerActions,
  type PreviewViewerActionDeps,
} from "./previewViewerActions";
import { createPreviewActions, type PreviewActionDeps } from "./previewActions";
import type { KeybindingDefinition } from "./types";
import {
  defaultKeybindings,
  matchKeybinding,
  mergeKeybindings,
  keybindingForAction,
  formatKeybindingLabel,
} from "./keybindings";
import { invokeAction, type InvokeOptions } from "./invoke";
import { ActionRegistry } from "./registry";
import { evaluateWhen } from "./when";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition, ArgSchema } from "./types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

type ConfirmState = {
  action: ActionDefinition;
  messageKey?: string;
  messageParams?: Record<string, string>;
  resolve: (approved: boolean) => void;
};

type ArgPromptState = {
  action: ActionDefinition;
  schema: ArgSchema;
  partial: Record<string, unknown>;
  resolve: (value: string | null) => void;
};

export function useActionSystem(
  contextKeys: ContextKeys,
  deps: Omit<BuiltinActionDeps, "openCommandPalette">,
  previewViewerDeps?: () => PreviewViewerActionDeps,
  previewActionDeps?: () => PreviewActionDeps,
  helpActionDeps?: () => HelpActionDeps,
) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userKeybindings, setUserKeybindings] = useState<KeybindingDefinition[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [argPromptState, setArgPromptState] = useState<ArgPromptState | null>(null);
  const [argPromptValue, setArgPromptValue] = useState("");
  const registryRef = useRef<ActionRegistry | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const previewViewerDepsRef = useRef(previewViewerDeps);
  previewViewerDepsRef.current = previewViewerDeps;
  const previewActionDepsRef = useRef(previewActionDeps);
  previewActionDepsRef.current = previewActionDeps;
  const helpActionDepsRef = useRef(helpActionDeps);
  helpActionDepsRef.current = helpActionDeps;

  if (!registryRef.current) {
    const registry = new ActionRegistry();
    for (const action of createBuiltinActions(() => ({
      ...depsRef.current,
      openCommandPalette: () => setPaletteOpen(true),
    }))) {
      registry.register(action);
    }
    if (previewViewerDepsRef.current) {
      for (const action of createPreviewViewerActions(
        () => previewViewerDepsRef.current!(),
      )) {
        registry.register(action);
      }
    }
    if (previewActionDepsRef.current) {
      for (const action of createPreviewActions(
        () => previewActionDepsRef.current!(),
      )) {
        registry.register(action);
      }
    }
    if (helpActionDepsRef.current) {
      for (const action of createHelpActions(() => helpActionDepsRef.current!())) {
        registry.register(action);
      }
    }
    registryRef.current = registry;
  }

  const registry = registryRef.current;

  useEffect(() => {
    void apiFetch("/api/keybindings")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          keybindings?: KeybindingDefinition[];
          keybinding?: KeybindingDefinition[];
        };
        const bindings = data.keybindings ?? data.keybinding ?? [];
        setUserKeybindings(bindings);
      })
      .catch(() => {});
  }, []);

  const keybindings = useMemo(
    () => mergeKeybindings(defaultKeybindings(), userKeybindings),
    [userKeybindings],
  );

  const hooks = useMemo(
    () => ({
      confirmDestructive: (action: ActionDefinition) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({ action, resolve });
        }),
      confirmMessage: (
        messageKey: string,
        params?: Record<string, string>,
      ) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({
            action: {
              id: "confirm.prompt",
              nameKey: "actions.confirm.title",
              categoryKey: "actions.view.category",
              handler: async () => {},
            },
            messageKey,
            messageParams: params,
            resolve,
          });
        }),
      promptArg: (
        action: ActionDefinition,
        schema: ArgSchema,
        partial: Record<string, unknown>,
      ) =>
        new Promise<string | null>((resolve) => {
          setArgPromptValue("");
          setArgPromptState({ action, schema, partial, resolve });
        }),
    }),
    [],
  );

  const invoke = useCallback(
    async (id: string, options: InvokeOptions = {}) =>
      invokeAction(registry, contextKeys, id, options, hooks),
    [registry, contextKeys, hooks],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (contextKeys["slideshow.open"]) {
        return;
      }
      const typing = isTypingTarget(event.target);
      const bindingAvailable = (binding: KeybindingDefinition) =>
        evaluateWhen(binding.when, contextKeys);
      const binding = matchKeybinding(keybindings, event, bindingAvailable);

      if (binding?.command === "view.open-command-palette") {
        event.preventDefault();
        void invoke(binding.command, { args: binding.args });
        return;
      }

      if (typing) {
        return;
      }

      if (binding) {
        event.preventDefault();
        void invoke(binding.command, { args: binding.args });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextKeys, invoke, keybindings]);

  const keybindingLabel = useCallback(
    (actionId: string, defaultKeybinding?: string) => {
      const chord = keybindingForAction(actionId, keybindings, defaultKeybinding);
      return chord ? formatKeybindingLabel(chord) : null;
    },
    [keybindings],
  );

  const dismissConfirm = useCallback((approved: boolean) => {
    setConfirmState((current) => {
      current?.resolve(approved);
      return null;
    });
  }, []);

  const dismissArgPrompt = useCallback((value: string | null) => {
    setArgPromptState((current) => {
      current?.resolve(value);
      return null;
    });
    setArgPromptValue("");
  }, []);

  return useMemo(
    () => ({
      registry,
      invoke,
      keybindings,
      userKeybindings,
      keybindingLabel,
      paletteOpen,
      setPaletteOpen,
      confirmState,
      dismissConfirm,
      confirmMessage: hooks.confirmMessage,
      argPromptState,
      argPromptValue,
      setArgPromptValue,
      dismissArgPrompt,
    }),
    [
      registry,
      invoke,
      keybindings,
      userKeybindings,
      keybindingLabel,
      paletteOpen,
      confirmState,
      dismissConfirm,
      hooks.confirmMessage,
      argPromptState,
      argPromptValue,
      dismissArgPrompt,
    ],
  );
}
