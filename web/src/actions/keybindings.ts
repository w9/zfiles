import type { ContextKeys } from "./contextKeys";
import type { KeybindingDefinition } from "./types";
import { evaluateWhen } from "./when";

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
  const fileList = "focus.pane == 'file-list'";
  const gridView = `${fileList} && listing.view == 'grid'`;
  return [
    { key: "Mod+P", command: "view.open-command-palette" },
    { key: "J", command: "selection.move-down", when: fileList },
    { key: "K", command: "selection.move-up", when: fileList },
    {
      key: "Shift+J",
      command: "selection.move-down",
      when: fileList,
      args: { extendRange: true },
    },
    {
      key: "Shift+K",
      command: "selection.move-up",
      when: fileList,
      args: { extendRange: true },
    },
    { key: "ArrowDown", command: "selection.move-down", when: fileList },
    { key: "ArrowUp", command: "selection.move-up", when: fileList },
    {
      key: "Shift+ArrowDown",
      command: "selection.move-down",
      when: fileList,
      args: { extendRange: true },
    },
    {
      key: "Shift+ArrowUp",
      command: "selection.move-up",
      when: fileList,
      args: { extendRange: true },
    },
    { key: "H", command: "selection.move-left", when: gridView },
    { key: "L", command: "selection.move-right", when: gridView },
    {
      key: "Shift+H",
      command: "selection.move-left",
      when: gridView,
      args: { extendRange: true },
    },
    {
      key: "Shift+L",
      command: "selection.move-right",
      when: gridView,
      args: { extendRange: true },
    },
    { key: "ArrowLeft", command: "selection.move-left", when: gridView },
    { key: "ArrowRight", command: "selection.move-right", when: gridView },
    {
      key: "Shift+ArrowLeft",
      command: "selection.move-left",
      when: gridView,
      args: { extendRange: true },
    },
    {
      key: "Shift+ArrowRight",
      command: "selection.move-right",
      when: gridView,
      args: { extendRange: true },
    },
    { key: "Enter", command: "navigation.open", when: fileList },
    { key: "Backspace", command: "navigation.up", when: fileList },
    {
      key: "Space",
      command: "viewer.slideshow",
      when: `${fileList} && preview.is-image == true`,
    },
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

export type KeybindingChordForContextOptions = {
  defaultKeybinding?: string;
  userBindings?: KeybindingDefinition[];
};

function isUnbindChord(key: string): boolean {
  return key === "" || key.startsWith("-");
}

export function keybindingChordForContext(
  actionId: string,
  mergedBindings: KeybindingDefinition[],
  contextKeys: ContextKeys,
  options: KeybindingChordForContextOptions = {},
): string | null {
  const whenMatches = (binding: KeybindingDefinition) =>
    evaluateWhen(binding.when, contextKeys);

  const userBindings = options.userBindings ?? [];
  const userForCommand = userBindings.filter((binding) => binding.command === actionId);
  if (userForCommand.length > 0) {
    for (const binding of userForCommand) {
      if (isUnbindChord(binding.key)) {
        return null;
      }
      if (whenMatches(binding)) {
        return binding.key;
      }
    }
    return null;
  }

  const mergedForCommand = mergedBindings.filter((binding) => binding.command === actionId);
  if (mergedForCommand.length > 0) {
    for (const binding of mergedForCommand) {
      if (whenMatches(binding)) {
        return binding.key;
      }
    }
    return null;
  }

  return options.defaultKeybinding ?? null;
}

export function keyPartLabel(
  part: string,
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): string {
  const isMac = platform.toLowerCase().includes("mac");
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
}

export function shiftClickModifierPrefix(
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): string {
  return `${keyPartLabel("Shift", platform)}+`;
}

export function shortcutsHintParams(
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): Record<string, string> {
  return {
    shiftClick: shiftClickModifierPrefix(platform),
    commandPalette: formatKeybindingLabel("Mod+P", platform),
  };
}

export function formatKeybindingLabel(
  chord: string,
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): string {
  const isMac = platform.toLowerCase().includes("mac");
  const labels = parseKeyChord(chord).map((part) => keyPartLabel(part, platform));
  return isMac ? labels.join("") : labels.join("+");
}
