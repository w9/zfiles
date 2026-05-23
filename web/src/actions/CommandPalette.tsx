import { useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchActions } from "./search";
import { isActionAvailable } from "./dispatch";
import KeybindingKbd from "./KeybindingKbd";
import { keybindingForAction } from "./keybindings";
import type { ActionRegistry } from "./registry";
import type { ContextKeys } from "./contextKeys";
import type { ActionDefinition, KeybindingDefinition } from "./types";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry: ActionRegistry;
  contextKeys: ContextKeys;
  keybindings: KeybindingDefinition[];
  dispatch: (id: string, options?: { args?: Record<string, unknown> }) => Promise<unknown>;
  title: string;
  placeholder: string;
  emptyLabel: string;
  argPromptTitle: string;
  argPromptPlaceholder: string;
  labelForKey: (key: string) => string;
};

function actionKeybindingChord(
  action: ActionDefinition,
  keybindings: KeybindingDefinition[],
): string | null {
  return keybindingForAction(action.id, keybindings, action.defaultKeybinding);
}

export default function CommandPalette({
  open,
  onOpenChange,
  registry,
  contextKeys,
  keybindings,
  dispatch,
  argPromptTitle,
  argPromptPlaceholder,
  title,
  placeholder,
  emptyLabel,
  labelForKey,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [argValue, setArgValue] = useState("");

  const results = useMemo(() => {
    const labels = Object.fromEntries(
      registry.list().flatMap((action) => {
        const entries: [string, string][] = [
          [action.nameKey, labelForKey(action.nameKey)],
          [action.categoryKey, labelForKey(action.categoryKey)],
        ];
        if (action.descriptionKey) {
          entries.push([action.descriptionKey, labelForKey(action.descriptionKey)]);
        }
        for (const aliasKey of action.aliasKeys ?? []) {
          entries.push([aliasKey, labelForKey(aliasKey)]);
        }
        return entries;
      }),
    );
    return searchActions(
      registry.list(),
      query,
      labels,
      (action) => isActionAvailable(action, contextKeys),
    );
  }, [registry, query, contextKeys, labelForKey]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof results>();
    for (const result of results) {
      const category = labelForKey(result.action.categoryKey);
      const current = byCategory.get(category) ?? [];
      current.push(result);
      byCategory.set(category, current);
    }
    return [...byCategory.entries()];
  }, [results, labelForKey]);

  const pendingAction = pendingActionId ? registry.get(pendingActionId) : null;
  const pendingSchema = pendingAction?.args?.[0];

  if (pendingAction && pendingSchema) {
    const chord = actionKeybindingChord(pendingAction, keybindings);
    return (
      <CommandDialog
        open={open}
        title={title}
        description={placeholder}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (!nextOpen) {
            setQuery("");
            setPendingActionId(null);
            setArgValue("");
          }
        }}
      >
        <CommandInput
          placeholder={argPromptPlaceholder}
          aria-label={argPromptTitle}
          value={argValue}
          onValueChange={setArgValue}
        />
        <CommandList>
          <CommandItem
            value={`continue ${pendingAction.id}`}
            className="flex items-center justify-between"
            onSelect={() => {
              void dispatch(pendingAction.id, { args: { [pendingSchema.name]: argValue } });
              onOpenChange(false);
              setQuery("");
              setPendingActionId(null);
              setArgValue("");
            }}
          >
            <span>{labelForKey(pendingAction.nameKey)}</span>
            {chord ? <KeybindingKbd chord={chord} /> : null}
          </CommandItem>
        </CommandList>
      </CommandDialog>
    );
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <CommandInput
        placeholder={placeholder}
        aria-label={title}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        {grouped.map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map(({ action }) => {
              const chord = actionKeybindingChord(action, keybindings);
              return (
                <CommandItem
                  key={action.id}
                  value={`${action.id} ${labelForKey(action.nameKey)}`}
                  className="flex items-center justify-between"
                  onSelect={() => {
                    if (action.args?.some((arg) => !arg.default)) {
                      setPendingActionId(action.id);
                      setArgValue("");
                      return;
                    }
                    void dispatch(action.id);
                    onOpenChange(false);
                    setQuery("");
                  }}
                >
                  <span>{labelForKey(action.nameKey)}</span>
                  {chord ? <KeybindingKbd chord={chord} /> : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
