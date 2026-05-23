import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/api";
import type { BuiltinActionDeps } from "./builtins";
import { createBuiltinActions, pluginActionToDefinition } from "./builtins";
import { createImageViewerActions, type ImageViewerActionDeps } from "./imageViewerActions";
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
  imageViewerDeps?: () => ImageViewerActionDeps,
) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userKeybindings, setUserKeybindings] = useState<KeybindingDefinition[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [argPromptState, setArgPromptState] = useState<ArgPromptState | null>(null);
  const [argPromptValue, setArgPromptValue] = useState("");
  const registryRef = useRef<ActionRegistry | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const imageViewerDepsRef = useRef(imageViewerDeps);
  imageViewerDepsRef.current = imageViewerDeps;

  if (!registryRef.current) {
    const registry = new ActionRegistry();
    for (const action of createBuiltinActions(() => ({
      ...depsRef.current,
      openCommandPalette: () => setPaletteOpen(true),
    }))) {
      registry.register(action);
    }
    if (imageViewerDepsRef.current) {
      for (const action of createImageViewerActions(
        () => imageViewerDepsRef.current!(),
      )) {
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

  useEffect(() => {
    void apiFetch("/api/actions/catalog")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const items = (await response.json()) as Array<{
          id: string;
          label: string;
          when?: string;
          contexts?: string[];
          destructive?: boolean;
          category?: string;
          default_keybinding?: string;
        }>;
        for (const item of items) {
          if (registry.get(item.id)) {
            continue;
          }
          registry.register(
            pluginActionToDefinition(
              {
                id: item.id,
                name: item.label,
                when: item.when,
                contexts: item.contexts,
                destructive: item.destructive,
                category: item.category ?? "actions.plugin.category",
                defaultKeybinding: item.default_keybinding,
              },
              async (actionId) => {
                const deps = depsRef.current;
                const selected = deps.getSelectedPaths();
                const fallback = deps.getListingPathAt(deps.getSelectedIndex());
                const paths = selected.length > 0 ? selected : fallback ? [fallback] : [];
                if (paths.length === 0) {
                  return;
                }
                await deps.runBulkAction(actionId, paths);
              },
            ),
          );
        }
      })
      .catch(() => {});
  }, [registry]);

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
      keybindingLabel,
      paletteOpen,
      setPaletteOpen,
      confirmState,
      dismissConfirm,
      argPromptState,
      argPromptValue,
      setArgPromptValue,
      dismissArgPrompt,
    }),
    [
      registry,
      invoke,
      keybindings,
      keybindingLabel,
      paletteOpen,
      confirmState,
      dismissConfirm,
      argPromptState,
      argPromptValue,
      dismissArgPrompt,
    ],
  );
}
