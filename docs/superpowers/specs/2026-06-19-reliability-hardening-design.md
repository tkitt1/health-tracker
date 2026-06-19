# Reliability Hardening — Design

**Date:** 2026-06-19
**Scope:** Code health / reliability fixes for the single-file health tracker (`index.html`).
**Out of scope:** monolith split, build step, event-handler refactor, render-function dedup, testability refactor (tests keep the repo's existing copy-paste `.mjs` convention).

## Goal

Make the app crash-resistant and honest about its save/sync state, without changing
its deliberate "single file, no build step, offline-first" design. Four contained
fixes, each with a regression test.

## Background

`index.html` is a ~4,245-line single-file app: localStorage is the source of truth,
mirrored to Supabase per key (newest-write-wins). An audit found four reliability gaps
where confirmed-real code can lose data or blank the UI. Notably, some read sites already
guard parsing (`getTodayField` line 2122, `metaGet` line 1690) while the central
`getData()` does not — these fixes make the safe pattern consistent.

## Fix 1 — Crash-proof all reads

**Problem:** `getData()` (line 2100) calls `JSON.parse(raw)` with no try/catch. It is the
central read behind nearly every interaction and render, so one corrupt `ht_<date>` value
throws a `SyntaxError` that propagates up and white-screens the app on load.

**Design:**
- Add a pure helper `safeParse(raw, fallback)` that returns `fallback` on parse failure.
- Route the currently-unguarded `JSON.parse` sites through it (audit all sites; the ones
  already wrapped in try/catch may be left or simplified to `safeParse`, but must not
  regress).
- `getData()` gets special handling so corrupt data is **preserved, not destroyed**: on
  parse failure, copy the raw bad value to a backup key `ht_corrupt_<date>_<epochms>`
  (best-effort; ignore if that write also fails), log a console warning, then return `{}`.
  This keeps the app usable while leaving the original bytes recoverable, instead of the
  next `saveData` silently overwriting them.

**Acceptance:**
- Corrupt `ht_<date>` value → app loads and renders; no thrown error.
- The corrupt raw string is found under an `ht_corrupt_<date>_*` key.
- Valid data is parsed unchanged (no behavior change on the happy path).

## Fix 2 — Handle localStorage write failure in `persist()`

**Problem:** `persist()` (line 1695) calls `localStorage.setItem(key, value)` with no
guard, then unconditionally records `meta[key] = Date.now()` (line 1696) as if the write
succeeded. On `QuotaExceededError` (or Safari private mode) the local write fails silently
while the app believes it saved, and the throw can also break the triggering interaction.

**Design:**
- Wrap `setItem` in try/catch.
- On failure: show a non-blocking warning to the user (e.g. a small banner/toast:
  "Couldn't save locally — storage may be full"), and do **not** let the error propagate.
- Still call `pushKey(...)` so a signed-in user's change is preserved in the cloud even
  when the local write failed (the in-memory `value` is the source of truth at that moment).
- Keep the happy path identical (write → meta update → push).

**Acceptance:**
- Simulated `setItem` throw does not propagate out of `persist()`.
- A user-visible warning is shown on local-write failure.
- Cloud `pushKey` is still attempted on local-write failure.

## Fix 3 — Per-section error boundary in `render()`

**Problem:** `render()` (line 4165) calls the sub-renders (`renderExercises`,
`renderCardio`, `renderIntake`, `renderMeasures`, `renderIF`, `renderMind`,
`renderRoutines`, `refreshTimerUI`, summaries) in sequence with no try/catch. If any one
throws (e.g. from data a merge left in a bad shape), the whole function halts and the page
does not render.

**Design:**
- Add a helper `safeRender(name, fn)` that runs `fn()` inside try/catch; on error it logs
  `name` + the error and renders a small inline "⚠ couldn't load this section" message
  into that section's container (when one is identifiable), then continues.
- Wrap each sub-render call in `render()` with `safeRender`.

**Acceptance:**
- If one sub-render throws, the others still run and the page still renders.
- The failing section shows an inline error rather than blanking the page.

## Fix 4 — Surface sync health

**Problem:** `pushKey()` (line 1707) swallows every error with an empty catch. Failed
pushes do retry on the next keep-alive, but the user gets no signal — they can believe
they are synced when every write is silently failing. (`initSync` session load at line 1843
is already guarded; the gap is the push path and the missing indicator.)

**Design:**
- Track a small module-level sync state: `synced` | `offline` | `error`.
- Update it from `pushKey` (and the pull path) outcomes: success → `synced`,
  network/offline → `offline`, other failures → `error`.
- Reflect it in the existing auth bar as a small unobtrusive indicator with a tooltip.
- Keep the existing retry-on-keep-alive behavior; this fix is visibility only.

**Acceptance:**
- A successful push sets state to `synced` and the indicator reflects it.
- A failing push sets state to `error`/`offline` and the indicator reflects it.
- No change to the retry mechanism.

## Tests

Match the repo's existing convention (`test/*.mjs`, run with `node`, helpers re-implemented
locally for isolation). One regression test per fix:

- `test/safe-parse.test.mjs` — `safeParse` returns fallback on bad input and parses valid
  input; the `getData` corruption path returns `{}` and records a backup key.
- `test/persist-quota.test.mjs` — a `setItem` that throws does not propagate out of the
  persist decision logic, and the cloud-push branch is still taken.
- `test/render-boundary.test.mjs` — `safeRender` isolates a throwing function so siblings
  still execute.
- `test/sync-status.test.mjs` — sync-state transitions for push success / offline / error.

Where a fix's logic lives inside DOM-coupled code, extract the pure decision into a small
named function so the test can re-implement/exercise it the way existing tests do.

## Risks & mitigations

- **Routing parse sites through `safeParse` could change behavior** if a site relied on a
  throw. Mitigation: audit each site; preserve the existing fallback value at each.
- **Backup keys could themselves consume quota.** Mitigation: backup write is best-effort
  inside try/catch; failure is ignored.
- **Indicator clutter.** Mitigation: small, in the existing auth bar, tooltip-only detail.
