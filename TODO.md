## High-level plan next

Bump icon sizes one Tailwind step (glyphs ≤ size-6, icon-button containers, FileIcon, controls/decorative). Cap hero icons above size-6. Follow-up: unified focus-ring treatment across inputs.

## TODO List

- [ ] Shared UI primitives: one-step icon bump (`button`, menus, `select`, `command`, `checkbox`, `badge`, `alert`, `input-group`, etc.)
- [ ] `FileIcon.tsx` + `gridIconPixelSize` min; update grid icon tests
- [ ] App chrome: breadcrumbs, toolbar, status, listings, dialogs, slideshow controls (cap h-16 hero)
- [ ] Icon-button containers `h-8`→`h-9`, `size-7`→`size-8` where applicable
- [ ] Run `pnpm test`; bump patch version in `Cargo.toml`
