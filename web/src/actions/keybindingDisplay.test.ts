import assert from "node:assert/strict";
import test from "node:test";

import { chordToKbdLabels } from "./keybindingDisplay";

test("chordToKbdLabels splits mod chords for Linux", () => {
  assert.deepEqual(chordToKbdLabels("Mod+P", "Linux x86_64"), ["Ctrl", "P"]);
});

test("chordToKbdLabels splits mod chords for macOS", () => {
  assert.deepEqual(chordToKbdLabels("Mod+Shift+P", "MacIntel"), ["⌘", "⇧", "P"]);
});

test("chordToKbdLabels keeps spelled-out keys whole", () => {
  assert.deepEqual(chordToKbdLabels("Enter", "Linux x86_64"), ["Enter"]);
  assert.deepEqual(chordToKbdLabels("Shift+ArrowDown", "Linux x86_64"), [
    "Shift",
    "ArrowDown",
  ]);
});
