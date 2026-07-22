# Agent instructions

You are working on **zfiles**, a local file server with a browser-based explorer. Read [design/design.md](design/design.md) for architecture, invariants, and technical goals before structural changes; [README.md](README.md) has the quick start and API summary.

## Development cycle

**Every user request to change the codebase — implement, add, fix, move, refactor, etc. — runs one development cycle.** There is no exemption for small diffs, for scope already discussed in earlier turns or summaries, or for requests without **"Go!"** ("Go!" is just shorthand for: run one cycle on the current near-term plan in the session TODO list). Only questions, reviews, planning, and read-only investigation are not cycles.

**Hard rule:** do not edit implementation files (`src/`, `web/`, `tests/`, `e2e/`, …) until steps 2–3 are **complete** for *this* request, in *this* session. Nothing carries over: a summarized conversation, an earlier discussion, or TODO items from a prior turn do not satisfy steps 2–3. Start a cycle by reading `design/design.md` and `AGENTS.md`; during planning (steps 2–3), use only the **TodoWrite** tool and your plan message — not implementation files.

0. **Dirty worktree** — Before AQ, check whether the git worktree is dirty (`git status` shows uncommitted or untracked changes). If it is, use **AskQuestion** to confirm how to proceed:
   - **(A) I just resolved it** — The user signals that they have just committed or otherwise cleared the worktree on their own; re-check `git status` and continue the cycle only if clean.
   - **(B) Commit in this conversation** — Commit the outstanding changes in this chat (respecting [commit-scope rules](#before-every-commit)), then continue the cycle.
   - **(C) Stop** — End this cycle without further edits.
   - **(D) Continue dirty** — Proceed with the cycle despite the dirty worktree.
   Skip this step when the worktree is clean.
1. **AQ (ask before planning)** — When the user appends **"AQ"** to a request, or the request has meaningful behavioral/edge-case ambiguity even without it, use the **AskQuestion** tool to confirm behavior and edge cases before planning. Never skip a triggered AQ, however trivial the change. AQ confirms *what* to build. Try to give every AQ question a recommended answer; when you do, put that option **first** and append **(Recommended)** to its label.
2. **Plan** — State the high-level plan in your response to the user: what this cycle will accomplish, what is deferred, and any follow-ups. Update it when progress or scope changes.
3. **TODO items** — Use the **TodoWrite** tool to create the cycle's scope as concrete items with `pending` status. As many items as the work warrants, **maximum 7** per cycle — extras wait for a future cycle. Edit, split, or reorder unfinished items only (`merge: true` to update without replacing the whole list). Mark each item `completed` when done; use `cancelled` if dropped. Keep the list near-term, not a roadmap.
4. **Implement** — Work through the new items: write tests first (design/design.md §5), implement the minimum to pass, and mark each item `completed` when done. Update `.gitignore` when appropriate. Implementation commits follow the user's git instructions — ask first unless they explicitly asked you to commit or finish the cycle.
5. **Verify** — Run the test suites covering what the cycle touched — `cargo test` for Rust, `pnpm test` for `web/`, both when unsure — and fix all failures before the cycle ends.
6. **Follow-ups** — After a large batch, suggest further TODO items for a future cycle in the plan message and/or your summary instead of exceeding the 7-item cap.

Completed work is tracked in git history and commit messages, not a repo checklist.

Do not skip or reorder steps.

## Remote debug logging

When Cursor **debug mode** is active and the user may test from a **remote browser** (phone, another machine, port-forwarded `cargo dev`, Lima VM → Mac → LAN, etc.), browser instrumentation **must not** call the ingest server at `http://127.0.0.1:7735/...`. In those setups `127.0.0.1` is the **browser's** loopback, not the dev host where Cursor runs the ingest server — logs fail silently if `.catch(()=>{})` swallows errors.

Use a **same-origin** path on the app the user already reaches (e.g. `http://192.168.x.x:<port>/`), proxied on the dev host to the ingest URL from the debug-mode system reminder.

### Per-session setup (add at start; remove after verification)

1. **Read debug-mode values** — Server endpoint, log path, and session ID come from the system reminder. Derive the ingest UUID from the endpoint path (`/ingest/<uuid>`).

2. **Rust dev route** (required for `cargo dev` / phone → forwarded zfiles port) — behind `dev-frontend`, add `POST /__debug/ingest` on the zfiles router (before the static/Vite fallback) that forwards the request body and headers (`Content-Type`, `X-Debug-Session-Id`) to `http://127.0.0.1:7735/ingest/<uuid>`. Restart `cargo dev` after adding it.

3. **Vite dev proxy** (optional; useful when hitting Vite `:5173` directly) — in `web/vite.config.ts` `server.proxy`, map `/__debug/ingest` → `http://127.0.0.1:7735/ingest/<uuid>`. If requests go through zfiles → Vite, also ensure the Vite proxy forwards `Content-Type` and `x-debug-session-id` (see `src/vite_proxy.rs` `forward_http_inner`).

4. **`web/src/debugLog.ts`** — dev-only helper that `fetch`es **`/__debug/ingest`** (relative URL), includes `sessionId` and `X-Debug-Session-Id`, and logs fetch failures with `console.warn` (do not swallow errors silently during setup verification). Example:

```typescript
const DEBUG_SESSION_ID = "<session-id>";
export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId?: string,
): void {
  if (!import.meta.env.DEV) return;
  fetch("/__debug/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      location,
      message,
      data,
      timestamp: Date.now(),
      ...(hypothesisId ? { hypothesisId } : {}),
    }),
  }).catch((err: unknown) => console.warn("[agent-debug-log]", location, err));
}
```

5. **Instrumentation** — wrap calls in `// #region agent log` / `// #endregion`; include `hypothesisId` in the payload. Prefer a mount ping with `window.location.origin` to confirm remote capture.

6. **Teardown** — after log-based verification or explicit user confirmation, remove the helper, proxy config, Rust route, and all `#region agent log` blocks in the same cycle or the next cleanup cycle.

### Pitfalls

| Symptom | Likely cause |
|---|---|
| Log file never created | Browser never reached ingest (wrong URL or proxy not restarted) |
| Works on host, not on phone | Still using `127.0.0.1:7735` in `fetch`, or missing Rust route for `cargo dev` |
| `400` from ingest via `cargo dev` | Vite proxy dropped `Content-Type` / `X-Debug-Session-Id`; use Rust route or fix header forwarding |
| Stale bundle | User on embedded `web/dist/` — need `cargo dev` or rebuild; optional temporary status-bar version override to confirm live UI |

### Before every commit

- **Commit scope** — commit only changes made in the current chat conversation. Never include edits made outside it (by the user or another session) unless the user explicitly asks.
- **Commits touching Rust** (`src/`, `tests/`, `Cargo.*`, Rust helpers under `e2e/`): run `cargo fmt` and `cargo clippy -- -D warnings` first and fix every warning — CI fails on either. Doc- and web-only commits may skip both.
- **Commits changing shipped behavior** (code or assets, not docs): bump the **patch** version in [Cargo.toml](Cargo.toml) `[package].version` in the same commit, so `zfiles --version` tracks the latest released change. Patch only, unless the user explicitly asks for minor/major; no standalone version-only commits.

## Frontend (web UI)

For the React explorer under `web/`:

1. **Tailwind CSS** — Style with Tailwind utilities and design tokens; keep custom CSS to globals, third-party overrides, or what Tailwind cannot express.
2. **shadcn/ui** — Prefer [shadcn/ui](https://ui.shadcn.com/) components whenever applicable; check the [components index](https://ui.shadcn.com/docs/components) before building custom, and consult the latest docs for stock styling and APIs (training data may be outdated). Custom components follow shadcn conventions: composable primitives, `cn()` merging, accessible Radix-style patterns, consistent variant/size APIs.
3. **i18n** — Every user-visible string goes through the i18n layer and ships in **all supported locales** (14 — see design/design.md § Frontend strategy); never hardcode display text.
