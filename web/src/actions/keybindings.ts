import type { KeybindingDefinition } from "./types";

export type { KeybindingDefinition };

const MODIFIER_ORDER = ["Mod", "Shift", "Alt"] as const;

export function parseKeyChord(chord: string): string[] {
  return chord
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === "mod") {
        return "Mod";
      }
      if (part.toLowerCase() === "shift") {
        return "Shift";
      }
      if (part.toLowerCase() === "alt") {
        return "Alt";
      }
      return part.length === 1 ? part.toUpperCase() : part;
    });
}

function eventModifiers(event: KeyboardEvent): string[] {
  const modifiers: string[] = [];
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");
  if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
    modifiers.push("Mod");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  return modifiers;
}

function eventKey(event: KeyboardEvent): string {
  if (event.key === " ") {
    return "Space";
  }
  if (event.key.length === 1) {
    return event.key.toUpperCase();
  }
  return event.key;
}

export function eventToChord(event: KeyboardEvent): string {
  const modifiers = eventModifiers(event);
  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
  return [...ordered, eventKey(event)].join("+");
}

export function matchKeybinding(
  bindings: KeybindingDefinition[],
  event: KeyboardEvent,
  isAvailable: (binding: KeybindingDefinition) => boolean,
): KeybindingDefinition | null {
  const chord = eventToChord(event);
  for (const binding of bindings) {
    if (parseKeyChord(binding.key).join("+") !== chord) {
      continue;
    }
    if (!isAvailable(binding)) {
      continue;
    }
    return binding;
  }
  return null;
}

export function defaultKeybindings(): KeybindingDefinition[] {
  return [
    { key: "Mod+P", command: "view.open-command-palette" },
    { key: "J", command: "selection.move-down", when: "focus.pane == 'file-list'" },
    { key: "K", command: "selection.move-up", when: "focus.pane == 'file-list'" },
    {
      key: "Shift+J",
      command: "selection.move-down",
      when: "focus.pane == 'file-list'",
      args: { extendRange: true },
    },
    {
      key: "Shift+K",
      command: "selection.move-up",
      when: "focus.pane == 'file-list'",
      args: { extendRange: true },
    },
    { key: "Enter", command: "navigation.open", when: "focus.pane == 'file-list'" },
    { key: "Backspace", command: "navigation.up", when: "focus.pane == 'file-list'" },
    { key: "Space", command: "selection.toggle", when: "focus.pane == 'file-list'" },
    {
      key: "Mod+A",
      command: "selection.select-all",
      when:
        "focus.pane == 'file-list' && listing.loaded == true && listing.visible-count > 0",
    },
    { key: "Escape", command: "selection.clear", when: "selection.count > 0" },
  ];
}

export function mergeKeybindings(
  defaults: KeybindingDefinition[],
  user: KeybindingDefinition[],
): KeybindingDefinition[] {
  const userChords = new Set(user.map((binding) => binding.key));
  const remaining = defaults.filter((binding) => !userChords.has(binding.key));
  return [...remaining, ...user];
}

export function keybindingForAction(
  actionId: string,
  bindings: KeybindingDefinition[],
  defaultKeybinding?: string,
): string | null {
  const binding = bindings.find((item) => item.command === actionId);
  return binding?.key ?? defaultKeybinding ?? null;
}

export function formatKeybindingLabel(
  chord: string,
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): string {
  const isMac = platform.toLowerCase().includes("mac");
  const parts = parseKeyChord(chord);
  const labels = parts.map((part) => {
    switch (part) {
      case "Mod":
        return isMac ? "⌘" : "Ctrl";
      case "Shift":
        return isMac ? "⇧" : "Shift";
      case "Alt":
        return isMac ? "⌥" : "Alt";
      case "Space":
        return "Space";
      default:
        return part;
    }
  });
  return isMac ? labels.join("") : labels.join("+");
}
