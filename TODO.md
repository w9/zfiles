## High-level plan next

Shell primitives (Breadcrumb, Menubar, Kbd, Badge, Table) are in place. This cycle completes registry alignment for Command, Dialog, Context Menu, and Tooltip; wires plugin manifest actions into the menubar; adds toolbar shortcut hints and listing-header E2E coverage; documents the shadcn update workflow. Sortable columns stay deferred — virtual scroll + `@tanstack/react-table` needs a dedicated pass.

## TODO List

- [x] i18n layer with English and Simplified Chinese catalogs + locale persistence
- [x] Migrate header controls (theme, backend status, language) to shadcn + i18n
- [x] Migrate App shell and listing/preview/context menu to Tailwind + i18n
- [x] Unit tests for i18n lookup and locale resolution; rebuild `web/dist`
- [x] Action schema types and `ActionRegistry` with register/list/dispatch
- [x] Reactive context-keys store (`focus.pane`, `selection.count`, `current-path`, `searcher.ready`, `connection.online`)
- [x] `when` expression parser/evaluator with unit tests
- [x] Built-in actions: navigation, selection, copy-paths, focus-search, open-command-palette
- [x] i18n catalog entries (en/zh-CN) for built-in action names, categories, descriptions
- [x] Keybinding layer: `Mod` abstraction, default bindings, when-scoped dispatch
- [x] shadcn Command + Dialog command palette (`Mod+P`) with fuzzy search and ranking
- [x] Migrate App keyboard shortcuts from ad-hoc handler to action keybindings
- [x] Context menu surface: filter registry by `contexts` + plugin `/api/actions` adapter
- [x] `dispatchAction` invokes handlers, enforces `when`, logs debug outcome
- [x] Unit tests: palette search ranking and action availability filtering
- [x] E2E smoke: command palette opens and runs a built-in action; plugin context menu still works
- [x] `readInitialLocale`: URL `?lang=` overrides localStorage; persist URL choice
- [x] Unit tests for URL locale resolution and alias handling
- [x] Update `index.html` boot script to apply `?lang=` before first paint
- [x] Add `--lang` to `ServeArgs` with validation for `en` and `zh-CN`
- [x] Extend `share_url` / browser URL builder to append `lang` query param
- [x] Wire `--lang` through transport banner and browser auto-open URL
- [x] Rust unit tests: CLI `--lang` parsing and share URL with token + lang
- [x] E2E smoke: `?lang=zh-CN` renders Simplified Chinese header strings
- [x] Kernel: `[[actions]]` in plugin manifest; merge with RPC `action/list`
- [x] `GET /api/actions/catalog` and `GET /api/keybindings` endpoints
- [x] Rust `keybindings.toml` loader (`~/.config/zfiles/keybindings.toml`) with tests
- [x] Frontend arg schema resolution and palette arg prompting step
- [x] Destructive action confirm modal; `selection.clear` marked destructive
- [x] `invokeAction` pipeline: when → confirm → args → handler
- [x] Menu bar surface: category menus dispatching registry actions
- [x] Toolbar surface: icon buttons for default action ids with `when` grey-out
- [x] Merge user keybindings over defaults in keyboard dispatch
- [x] Unit tests: arg resolution, keybinding merge, invoke confirm skip via args
- [x] Integration + E2E: manifest actions listed; menu/toolbar smoke
- [x] Add shadcn components via CLI: kbd, badge, breadcrumb, menubar, table
- [x] Replace `KeybindingHint` with `Kbd` / `KbdGroup` in palette and menus
- [x] Migrate action `MenuBar` to shadcn `Menubar` with shortcuts
- [x] Migrate App path navigation to shadcn `Breadcrumb`
- [x] Migrate `BackendStatus` pill to shadcn `Badge` variants
- [x] Refactor `VirtualListing` to shadcn `Table` + column header row (data-table pattern)
- [x] Unit tests for keybinding chord → `Kbd` parts; update E2E for menubar roles
- [ ] Re-add shadcn `command` and `dialog` via CLI; diff and reconcile with existing wrappers
- [ ] Migrate `ContextMenu` to shadcn `Context Menu` component
- [ ] Add keyboard shortcut tooltips on toolbar buttons using `Kbd` + `Tooltip`
- [ ] E2E smoke: listing column headers (Name / Size) visible in explorer
- [ ] Expose plugin manifest actions in menubar categories when contexts match
- [ ] Document shadcn component update workflow in README (CLI add + reconcile)
- [ ] Optional: evaluate `@tanstack/react-table` for sortable listing columns
