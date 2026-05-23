import assert from "node:assert/strict";
import test from "node:test";

import { matchKeybinding, mergeKeybindings, parseKeyChord, defaultKeybindings, formatKeybindingLabel, keybindingForAction } from "./keybindings";

test("parseKeyChord normalizes mod shift and key", () => {
  assert.deepEqual(parseKeyChord("Mod+P"), ["Mod", "P"]);
  assert.deepEqual(parseKeyChord("Mod+Shift+P"), ["Mod", "Shift", "P"]);
});

test("matchKeybinding respects when expression", () => {
  const binding = {
    key: "Mod+P",
    command: "view.open-command-palette",
  };
  const event = {
    key: "p",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  } as KeyboardEvent;
  assert.equal(matchKeybinding([binding], event, () => true)?.command, binding.command);
  assert.equal(matchKeybinding([binding], event, () => false), null);
});

test("mergeKeybindings lets user override default chords", () => {
  const merged = mergeKeybindings(defaultKeybindings(), [
    { key: "Mod+P", command: "navigation.focus-search", when: "searcher.ready" },
  ]);
  assert.equal(
    merged.find((binding) => binding.key === "Mod+P")?.command,
    "navigation.focus-search",
  );
});

test("keybindingForAction prefers configured binding over action default", () => {
  const bindings = defaultKeybindings();
  assert.equal(
    keybindingForAction("view.open-command-palette", bindings, "Mod+Shift+P"),
    "Mod+P",
  );
  assert.equal(
    keybindingForAction("navigation.go-to-path", bindings, "Mod+G"),
    "Mod+G",
  );
});

test("formatKeybindingLabel renders platform-specific modifiers", () => {
  assert.equal(formatKeybindingLabel("Mod+P", "MacIntel"), "⌘P");
  assert.equal(formatKeybindingLabel("Mod+Shift+P", "Linux x86_64"), "Ctrl+Shift+P");
});
