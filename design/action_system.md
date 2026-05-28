# zfiles UI — action system

> **Scope (post–dual-mode refactor):** Built-in actions only. Plugin action registration, `plugin.*` context keys, and JSON-RPC action dispatch were removed. Sections below that describe plugin integration are **historical** and kept for reference.

## Overview

The action system is the unified entry point for everything a user can ask zfiles to do. Each user-invocable operation — delete the selected files, toggle the preview pane, open the command palette — is defined once as a piece of data and exposed through multiple surfaces: a command palette, the menu bar, the toolbar, keyboard shortcuts, context menus, and any future automation or scripting layer.

Adding a new action gives you all these surfaces for free. Adding a new surface gives you discoverability over every existing action.

The model is what VS Code, Sublime, Linear, and Obsidian converged on independently. The cost of adopting it is upfront design; the payoff compounds as the app grows.

## Key points

The system rests on seven principles.

1. **Actions are data, not functions.** The handler is one field on an action object; everything else (name, args, keybinding, availability) lives alongside it as declarative metadata.

2. **Ids are stable; display strings are i18n'd.** The id is the canonical identity used in keybindings, settings, and telemetry. It never changes and is never translated.

3. **Every action declares when it's available.** A `when` expression over a reactive context-keys store determines whether the action is visible, enabled, or hidden across every surface.

4. **Arguments are typed and have context-driven defaults.** Arg schemas describe what the action needs; default resolvers pull from current selection, focus, and path so most invocations require zero manual input.

5. **Keybindings are layered and scoped.** Built-in defaults + user overrides, resolved with explicit precedence. The same chord can mean different things in different focused contexts.

6. **The palette is the universal discovery surface.** Anything a user can do is findable by typing a few characters.

## The action schema

Each action is an object with this shape (TypeScript notation):

```ts
interface Action {
  id: string;                     // hierarchical, dot-separated, never i18n'd
  name: I18nKey;                  // display name
  description?: I18nKey;          // longer text shown in palette
  category: I18nKey;              // grouping label (e.g. "File", "View")
  aliases?: I18nKey[];            // extra search terms
  icon?: string;                  // icon id for toolbar / palette
  when?: string;                  // context-keys boolean expression
  args?: ArgSchema[];             // typed argument declarations
  defaultKeybinding?: Keybinding; // shipped default; user can override
  contexts?: ContextMenu[];       // which context menus include this action
  destructive?: boolean;          // triggers confirm-by-default UI treatment
  handler: ActionHandler;         // async function (args, ctx) => Result
}
```

`I18nKey` is a string referencing an entry in the i18n message catalog. `Keybinding` is the abstract key declaration discussed below.

Ids are hierarchical and dot-separated: `file.delete-selected`, `view.toggle-preview-pane`, `selection.invert`. The convention is `category.action-name`. Ids are part of the public contract — they appear in user keybinding files and exported settings — so they are stable across releases.

## Context keys and `when` expressions

Context keys are a small reactive store of named values that components write to as user state changes:

| Key | Type | Updates when |
|---|---|---|
| `focus.pane` | string | focused panel changes |
| `selection.count` | number | selection size changes |
| `selection.types` | string[] | selection MIME types change |
| `current-path` | string | navigation moves |
| `connection.online` | boolean | WebSocket connects / disconnects |
| `read-only` | boolean | mode toggles |

The `when` DSL is a minimal boolean expression language over these keys:

```
selection.count > 0
focus.pane == 'file-list' && !read-only
```

When relevant context keys change, every dependent `when` evaluation re-runs and the corresponding UI updates: the palette filters, menus enable or disable, toolbar buttons grey out. Each surface decides what to do with a failed `when` — palette typically hides; menu bar typically greys; keybindings simply don't fire.

A disabled action's UI should explain why on hover. The simplest implementation auto-generates the message from the failing clause ("Delete is unavailable: no files selected" derived from `selection.count > 0`). Actions can supply a custom `whenFailureMessage` for clarity in cases where the auto-generated text is unhelpful.

## Argument types and resolution

Args are declared with a small type system:

```ts
type ArgSchema =
  | { name: string; type: 'file-path';      default?: ArgDefault }
  | { name: string; type: 'file-paths';     default?: ArgDefault }
  | { name: string; type: 'directory-path'; default?: ArgDefault }
  | { name: string; type: 'string';  pattern?: string;          default?: string }
  | { name: string; type: 'number';  min?: number; max?: number; default?: number }
  | { name: string; type: 'enum';    values: EnumValue[];        default?: string }
  | { name: string; type: 'boolean';                              default?: boolean };

type ArgDefault =
  | { from: 'selection' }        // current selection (for file-paths)
  | { from: 'selection.first' }  // first selected file (for file-path)
  | { from: 'current-path' }     // current directory
  | { from: 'context-key'; key: string }
  | { value: any };              // static literal
```

Resolution order at invocation:

1. Explicitly provided args (from a keybinding's args field, or palette user entry)
2. The arg's declared default resolver
3. Interactive prompt via the palette's chained quick-pick

Most actions resolve fully from context. "Delete Selected Files" needs no user input — `file-paths` defaults to `selection`, and the action fires. "Move Files To..." takes a `directory-path` that has no good default; the palette prompts for it with a directory picker. "Rename..." takes the selection as source and a `string` for the new name; the palette prompts for the string.

Keybindings can supply args directly:

```toml
[[keybinding]]
key = "Mod+Shift+Delete"
command = "file.delete"
args = { confirm = false }
```

This is how a power user binds "delete without confirmation" without modifying the action definition.

## Surfaces

Each surface is a presentation layer over the action registry. None of them know about handlers; all dispatch goes through the registry.

**Command palette** (default `Mod+P`). Fuzzy search across all actions in the current locale, ranked. Multi-step quick-pick for argument gathering. The primary discovery and power-user surface.

**Menu bar.** A declarative tree referencing actions and categories. The bar config (in code or theme) names which categories appear and their order; actions appear under their declared category. `when` filters hide or grey entries.

**Toolbar.** Explicit list of action ids in user or default config. Each renders as a button using the action's icon, with the name as the tooltip. `when` greys disabled buttons.

**Context menu.** Actions opt in via the `contexts` field — e.g. `contexts: ['file-list', 'preview-pane']`. Right-clicking dispatches to the matching surface and shows actions whose `when` passes.

**Keybindings.** A layered keymap dispatches chords to actions. Detailed below.

**Programmatic.** Future scripts or automation may dispatch actions by id through the registry. Same auth model and `when` checks apply.

## Keybindings

Bindings layer in two tiers:

1. Built-in defaults shipped with the app
2. User overrides in `~/.config/zfiles/keybindings.toml`

User overrides win. Conflicts surface in the settings UI rather than silently overriding.

Bindings are context-scoped via the same `when` mechanism, so the same chord can dispatch different actions depending on focus:

```toml
[[keybinding]]
key = "Mod+A"
command = "edit.select-all"
when = "focus.pane == 'file-list'"

[[keybinding]]
key = "Mod+A"
command = "edit.select-all-text"
when = "focus.pane == 'search-input'"
```

Chord sequences are two-stroke chains: `Mod+K Mod+S`.

Cross-platform key abstraction: declare keys using `Mod` (resolves to Cmd on macOS, Ctrl elsewhere), plus `Alt`, `Shift`, and `Meta`. Even on Linux-first v1, declare bindings abstractly so v2 cross-platform support is trivial.

## Palette behavior

Search matches against the action's name, category, description, and aliases — all in the current locale. The English catalog serves as a fallback for users who switch locales but still know action names in English.

Ranking factors, in order of weight:

- Actions whose `when` evaluates true rank above unavailable ones
- Recently used actions float to the top
- Actions with bound keybindings rank higher (the user has signaled they care)
- Exact prefix matches > word-start matches > fuzzy mid-word matches

Multi-step argument prompting: when an invoked action has required args without resolvable defaults, the palette transitions into a chained quick-pick. Each arg becomes a step, with a back option. The user can cancel at any step.

The palette also displays the bound keybinding next to each action name, which doubles as keyboard discoverability — users learn shortcuts for the actions they use repeatedly.

## i18n

Action strings flow through the standard i18n pipeline. `name`, `description`, `category`, `aliases`, and any enum value labels reference message catalog keys.

Search uses the current locale's strings with English as a fallback. The palette does not search across all locales simultaneously — that produces too many coincidental matches.

## Behavior and lifecycle

All handlers are async. The action infrastructure shows a progress indicator for any handler taking longer than ~100ms. Failed handlers raise structured errors that the UI surfaces with the action's name and error message attached.

Every invocation is logged at debug level: action id, resolved args, duration, outcome. This is the single highest-leverage debugging affordance in the system — when a user reports "the UI did something weird," the action log usually shows exactly what happened.

Destructive actions (`destructive: true`) trigger a confirmation modal by default. A user can disable confirmation per-action in settings; a keybinding can override via `args = { confirm = false }` for users who want fast destructive operations.

## Deferred to later

Three things are deliberately deferred from v1 of the action system:

**Undo.** Undo for a file explorer is genuinely complicated — undoing a delete means restoring from trash, undoing a move means re-moving across a possibly-changed state. The action system can support it later (an action declares an inverse action or an undo-record producer), but the model and UI deserve their own design pass when the priority arrives.

**Action results consumed by other actions.** If handlers can return values other actions consume, you're building a scripting layer. Powerful but a much bigger commitment; revisit when macro and automation requests appear.

**Inter-action scripting.** Whether one action can invoke another through the registry. Probably yes long-term, but a security and stability consideration that needs its own design pass.

These are noted to make sure their absence is a choice and not an oversight.