import assert from "node:assert/strict";
import test from "node:test";

import {
  matchKeybinding,
  mergeKeybindings,
  parseKeyChord,
  defaultKeybindings,
  formatKeybindingLabel,
  keybindingForAction,
  keybindingChordForContext,
  shortcutsHintParams,
} from "./keybindings";
import { defaultContextKeys } from "./contextKeys";
import { evaluateWhen } from "./when";

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
    { key: "Mod+P", command: "navigation.go-to-path" },
  ]);
  assert.equal(
    merged.find((binding) => binding.key === "Mod+P")?.command,
    "navigation.go-to-path",
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

test("shortcutsHintParams uses modifier icons on macOS", () => {
  assert.deepEqual(shortcutsHintParams("MacIntel"), {
    shiftClick: "⇧+",
    commandPalette: "⌘P",
  });
});

test("shortcutsHintParams uses Ctrl labels elsewhere", () => {
  assert.deepEqual(shortcutsHintParams("Linux x86_64"), {
    shiftClick: "Shift+",
    commandPalette: "Ctrl+P",
  });
});

test("matchKeybinding matches Mod+A select-all chord", () => {
  const bindings = defaultKeybindings();
  const event = {
    key: "a",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  } as KeyboardEvent;
  const binding = matchKeybinding(
    bindings,
    event,
    (item) => item.when == null || item.when.includes("listing.visible-count"),
  );
  assert.equal(binding?.command, "selection.select-all");
});

test("default movement keybindings use arrow keys only", () => {
  const bindings = defaultKeybindings();
  const movementKeys = bindings
    .filter((binding) => binding.command.startsWith("selection.move-"))
    .map((binding) => binding.key)
    .sort();
  assert.deepEqual(movementKeys, [
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "Shift+ArrowDown",
    "Shift+ArrowLeft",
    "Shift+ArrowRight",
    "Shift+ArrowUp",
  ]);
});

test("matchKeybinding ignores vim-style movement keys", () => {
  const bindings = defaultKeybindings();
  for (const key of ["h", "j", "k", "l"]) {
    assert.equal(
      matchKeybinding(
        bindings,
        {
          key,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        } as KeyboardEvent,
        () => true,
      ),
      null,
    );
  }
});

test("matchKeybinding matches grid-only horizontal navigation", () => {
  const bindings = defaultKeybindings();
  const event = {
    key: "ArrowLeft",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  } as KeyboardEvent;
  const gridAvailable = (binding: { when?: string }) =>
    binding.when?.includes("listing.view == 'grid'") ?? false;
  const tableAvailable = (binding: { when?: string }) =>
    binding.when != null && !binding.when.includes("listing.view");
  assert.equal(
    matchKeybinding(bindings, event, gridAvailable)?.command,
    "selection.move-left",
  );
  assert.equal(matchKeybinding(bindings, event, tableAvailable), null);
});

test("matchKeybinding matches Space slideshow when image focused in file list", () => {
  const bindings = defaultKeybindings();
  const event = {
    key: " ",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  } as KeyboardEvent;
  const bindingAvailable = (binding: { when?: string }) =>
    evaluateWhen(binding.when, {
      ...defaultContextKeys(),
      "preview.is-image": true,
    });
  assert.equal(
    matchKeybinding(bindings, event, bindingAvailable)?.command,
    "viewer.slideshow",
  );
});

test("matchKeybinding ignores Space when non-image focused in file list", () => {
  const bindings = defaultKeybindings();
  const event = {
    key: " ",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  } as KeyboardEvent;
  const bindingAvailable = (binding: { when?: string }) =>
    evaluateWhen(binding.when, defaultContextKeys());
  assert.equal(matchKeybinding(bindings, event, bindingAvailable), null);
});

test("keybindingChordForContext prefers binding whose when matches context", () => {
  const bindings = defaultKeybindings();
  const gridContext = {
    "focus.pane": "file-list",
    "listing.view": "grid",
    "preview.is-image": true,
  };
  const tableContext = {
    "focus.pane": "file-list",
    "listing.view": "table",
    "preview.is-image": true,
  };
  assert.equal(
    keybindingChordForContext("viewer.slideshow", bindings, gridContext, {
      defaultKeybinding: "Space",
    }),
    "Space",
  );
  assert.equal(
    keybindingChordForContext("viewer.slideshow", bindings, tableContext, {
      defaultKeybinding: "Space",
    }),
    "Space",
  );
  assert.equal(
    keybindingChordForContext("selection.toggle", bindings, tableContext),
    null,
  );
});

test("keybindingChordForContext returns merged default when when matches", () => {
  const bindings = defaultKeybindings();
  const context = {
    "focus.pane": "file-list",
    "server.read-only": false,
  };
  assert.equal(
    keybindingChordForContext("file.copy", bindings, context, {
      defaultKeybinding: "Mod+C",
    }),
    "Mod+C",
  );
});

test("keybindingChordForContext falls back to action default when unbound in merged list", () => {
  const bindings = defaultKeybindings();
  const context = { "focus.pane": "file-list", "selection.count": 1 };
  assert.equal(
    keybindingChordForContext("selection.copy-paths", bindings, context, {
      defaultKeybinding: "Mod+Shift+C",
    }),
    "Mod+Shift+C",
  );
});

test("keybindingChordForContext honors user override and unbind for a command", () => {
  const bindings = defaultKeybindings();
  const context = { "focus.pane": "file-list" };
  assert.equal(
    keybindingChordForContext("file.rename", bindings, context, {
      defaultKeybinding: "F2",
      userBindings: [{ key: "Mod+Shift+R", command: "file.rename" }],
    }),
    "Mod+Shift+R",
  );
  assert.equal(
    keybindingChordForContext("file.rename", bindings, context, {
      defaultKeybinding: "F2",
      userBindings: [{ key: "-F2", command: "file.rename" }],
    }),
    null,
  );
  assert.equal(
    keybindingChordForContext("file.rename", bindings, context, {
      defaultKeybinding: "F2",
      userBindings: [{ key: "Mod+Shift+R", command: "file.rename", when: "selection.count > 1" }],
    }),
    null,
  );
});

test("matchKeybinding matches arrow up/down in file list", () => {
  const bindings = defaultKeybindings();
  const event = {
    key: "ArrowDown",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  } as KeyboardEvent;
  const binding = matchKeybinding(
    bindings,
    event,
    (item) => item.when?.includes("focus.pane == 'file-list'") ?? false,
  );
  assert.equal(binding?.command, "selection.move-down");
});

test("matchKeybinding matches built-in file operation shortcuts", () => {
  const bindings = defaultKeybindings();
  const context = {
    ...defaultContextKeys(),
    "focus.pane": "file-list",
    "server.read-only": false,
    "selection.count": 1,
    "clipboard.count": 1,
  };
  const bindingAvailable = (binding: { when?: string }) =>
    evaluateWhen(binding.when, context);

  assert.equal(
    matchKeybinding(
      bindings,
      {
        key: "Delete",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      bindingAvailable,
    )?.command,
    "file.delete",
  );
  assert.equal(
    matchKeybinding(
      bindings,
      {
        key: "F2",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      bindingAvailable,
    )?.command,
    "file.rename",
  );
  assert.equal(
    matchKeybinding(
      bindings,
      {
        key: "c",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      bindingAvailable,
    )?.command,
    "file.copy",
  );
  assert.equal(
    matchKeybinding(
      bindings,
      {
        key: "x",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      bindingAvailable,
    )?.command,
    "file.cut",
  );
  assert.equal(
    matchKeybinding(
      bindings,
      {
        key: "v",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      bindingAvailable,
    )?.command,
    "file.paste",
  );
});

test("matchKeybinding ignores file delete on read-only server", () => {
  const bindings = defaultKeybindings();
  const context = {
    ...defaultContextKeys(),
    "focus.pane": "file-list",
    "server.read-only": true,
    "selection.count": 1,
  };
  const bindingAvailable = (binding: { when?: string }) =>
    evaluateWhen(binding.when, context);
  assert.equal(
    matchKeybinding(
      bindings,
      {
        key: "Delete",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      } as KeyboardEvent,
      bindingAvailable,
    ),
    null,
  );
});
