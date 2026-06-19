# Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the single-file health tracker crash-resistant on corrupt/failed storage and honest about its sync state, without changing its no-build single-file design.

**Architecture:** Four contained, defensive changes inside `index.html` (guards + small helpers), each landing as its own atomic commit with a Node regression test. No data migration; existing behavior on the happy path is unchanged.

**Tech Stack:** Vanilla JS in a single `index.html`; localStorage + Supabase; tests are plain `.mjs` files run with `node`, re-implementing the pure helpers locally (matching the existing `test/` convention).

## Global Constraints

- Single file, no build step, no new runtime dependencies (copied verbatim from spec scope).
- Tests follow the existing convention: `test/<name>.test.mjs`, run with `node test/<name>.test.mjs`, a tiny `eq()`/`pass`/`fail` harness, `process.exit(fail ? 1 : 0)`, pure helpers re-implemented identically in the test file.
- Backup/diagnostic localStorage keys MUST NOT start with `ht_` — line 1777 enumerates every `ht_`-prefixed key for cloud sync, so an `ht_`-prefixed backup would propagate to the cloud and other devices. Use the `__ht_` prefix for local-only keys.
- Happy path must be byte-for-byte unchanged: valid data parses, saves, renders, and syncs exactly as before.

---

### Task 1: Crash-proof reads (`safeParse` + corrupt-record backup)

**Files:**
- Modify: `index.html` — add `safeParse` near line 1688 (after `LOCAL_ONLY_KEYS`); harden `getData` at 2097-2101; route unguarded parse sites at 3896, 3986, 4087 through `safeParse`.
- Test: `test/safe-parse.test.mjs`

**Interfaces:**
- Produces: `safeParse(raw, fallback)` → parsed value, or `fallback` if `raw` is null/undefined or invalid JSON.
- Produces: `getData()` unchanged signature; on corrupt today-record it backs up raw bytes to `__ht_corrupt_<date>_<epochms>` and returns `{}`.

- [ ] **Step 1: Write the failing test**

Create `test/safe-parse.test.mjs`:

```javascript
// Verification for crash-proof reads.
// Run: node test/safe-parse.test.mjs
//
// Bug: getData() did JSON.parse(raw) with no try/catch, so a single corrupt
// ht_<date> value threw and white-screened the whole app. Fix: a safeParse
// helper for read sites, plus getData backs up corrupt bytes and returns {}.

// ---- pure helpers under test (kept identical to the copies in index.html) ----
function safeParse(raw, fallback) {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

// getData's corruption handling, factored to be storage-injectable for the test.
function getDataFrom(store, key, now) {
  const raw = store.getItem(key);
  if (raw == null) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    try { store.setItem('__ht_corrupt_' + key.slice(3) + '_' + now, raw); } catch (e2) {}
    return {};
  }
}

// ---- tiny in-memory localStorage ----
function makeStore(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    keys: () => [...m.keys()],
    get: k => m.get(k),
  };
}

// ---- tiny assert harness ----
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
}

console.log('safeParse:');
eq('valid json parses', safeParse('{"a":1}', null).a, 1);
eq('invalid json -> fallback', safeParse('{not json', 'FB'), 'FB');
eq('null raw -> fallback', safeParse(null, 'FB'), 'FB');
eq('empty-array fallback honored on bad input',
  JSON.stringify(safeParse('oops', [])), '[]');

console.log('\ngetData corruption handling:');
const good = makeStore({ 'ht_2026-06-13': '{"calories":[{"id":"a"}]}' });
eq('valid day record parses unchanged',
  JSON.stringify(getDataFrom(good, 'ht_2026-06-13', 111)),
  '{"calories":[{"id":"a"}]}');

const bad = makeStore({ 'ht_2026-06-13': '{broken' });
eq('corrupt day record returns {}',
  JSON.stringify(getDataFrom(bad, 'ht_2026-06-13', 111)), '{}');
eq('corrupt bytes are backed up under __ht_corrupt_*',
  bad.get('__ht_corrupt_2026-06-13_111'), '{broken');
eq('backup key is NOT ht_-prefixed (stays local-only)',
  bad.keys().some(k => k.startsWith('ht_') && k.includes('corrupt')), false);

const missing = makeStore({});
eq('missing record -> {}',
  JSON.stringify(getDataFrom(missing, 'ht_2026-06-13', 111)), '{}');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/safe-parse.test.mjs`
Expected: FAIL — the file is new, but more importantly this locks the contract before editing `index.html`. (If it passes immediately because the helpers are self-contained, that is fine; the test's purpose is to pin the behavior we are about to add to `index.html`. Proceed to Step 3 and keep the helpers identical.)

- [ ] **Step 3: Add `safeParse` to `index.html`**

After line 1688 (`const LOCAL_ONLY_KEYS = [...]`), insert:

```javascript
    // Parse JSON without ever throwing — corrupt localStorage must not crash a read.
    function safeParse(raw, fallback) {
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    }
```

- [ ] **Step 4: Harden `getData` (lines 2097-2101)**

Replace:

```javascript
    function getData() {
      const key = 'ht_' + dateKey();
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    }
```

with:

```javascript
    function getData() {
      const key = 'ht_' + dateKey();
      const raw = localStorage.getItem(key);
      if (raw == null) return {};
      try {
        return JSON.parse(raw);
      } catch (e) {
        // Corrupt day record: preserve the raw bytes for recovery under a
        // local-only key (no ht_ prefix => never synced), then fall back to
        // empty so the app keeps working instead of white-screening.
        try { localStorage.setItem('__ht_corrupt_' + dateKey() + '_' + Date.now(), raw); } catch (e2) {}
        console.warn('Corrupt record for ' + key + '; backed up and reset.', e);
        return {};
      }
    }
```

- [ ] **Step 5: Route the remaining unguarded parse sites through `safeParse`**

Line 3896 — replace `JSON.parse(localStorage.getItem('ht_' + d) || '{}')` with `safeParse(localStorage.getItem('ht_' + d), {})`.

Line 3986 — replace `data: JSON.parse(localStorage.getItem(k) || '{}')` with `data: safeParse(localStorage.getItem(k), {})`.

Line 4087 — in the `days.push(...)` call, replace `data: JSON.parse(raw)` with `data: safeParse(raw, {})`.

(Leave the already-guarded sites — 1601, 1690, 2122, 2127, 2161, 2443, 2449, 2453, 3333, 3412, 3421, 4127 — as they are; they already cannot throw.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `node test/safe-parse.test.mjs`
Expected: PASS — all assertions green, `N passed, 0 failed`.

- [ ] **Step 7: Smoke-check no JSON.parse remains unguarded**

Run: `grep -n "JSON.parse" index.html | grep -v "safeParse\|try {\|catch"`
Expected: no line that is a bare `JSON.parse(` outside a try/catch (the grep should return only lines that are inside try blocks or the `safeParse` definition itself). Visually confirm 3896/3986/4087 now use `safeParse`.

- [ ] **Step 8: Commit**

```bash
git add index.html test/safe-parse.test.mjs
git commit -m "fix: corrupt localStorage no longer crashes the app

- add safeParse helper; route unguarded read sites through it
- getData backs up corrupt day records to a local-only key and resets"
```

---

### Task 2: Survive localStorage write failures in `persist()`

**Files:**
- Modify: `index.html` — `persist` at 1693-1698; add a small `warnOnce`-style banner helper and a one-time CSS-free inline banner element. Add an `id="appNotice"` container to the page header.
- Test: `test/persist-quota.test.mjs`

**Interfaces:**
- Consumes: `pushKey(key, value, ts)` (existing), `metaGet`/`metaSet` (existing).
- Produces: `persist(key, value)` never throws on a failed local write; on failure it shows a non-blocking notice and still attempts `pushKey`.

- [ ] **Step 1: Write the failing test**

Create `test/persist-quota.test.mjs`:

```javascript
// Verification that a failed localStorage write does not crash or silently lose data.
// Run: node test/persist-quota.test.mjs
//
// Bug: persist() called localStorage.setItem with no try/catch and then marked
// the key as saved regardless. On QuotaExceededError the write threw (breaking
// the triggering interaction) while meta claimed success. Fix: guard the write,
// warn the user, and still push to the cloud so a signed-in user keeps the data.

// ---- persist's decision logic, factored for injection (kept in sync with index.html) ----
function persistCore(store, meta, key, value, now, notify, pushed) {
  let localOk = true;
  try { store.setItem(key, value); } catch (e) { localOk = false; notify(); }
  meta[key] = now;            // last-modified stamp drives sync regardless of local success
  pushed.push({ key, value, ts: meta[key] }); // always attempt cloud push
  return localOk;
}

// ---- harness ----
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
}
function okStore() { const m = {}; return { setItem: (k, v) => { m[k] = v; }, get: k => m[k] }; }
function fullStore() { return { setItem: () => { throw new Error('QuotaExceededError'); } }; }

console.log('persist happy path:');
let meta = {}, pushed = [], notified = 0;
const s1 = okStore();
const ok1 = persistCore(s1, meta, 'ht_2026-06-13', '{"a":1}', 100, () => notified++, pushed);
eq('returns true on success', ok1, true);
eq('value written locally', s1.get('ht_2026-06-13'), '{"a":1}');
eq('no notice on success', notified, 0);
eq('cloud push queued', pushed.length, 1);

console.log('\npersist on quota-exceeded:');
meta = {}; pushed = []; notified = 0;
const ok2 = persistCore(fullStore(), meta, 'ht_2026-06-13', '{"a":1}', 200, () => notified++, pushed);
eq('does NOT throw / returns false', ok2, false);
eq('user is notified once', notified, 1);
eq('cloud push still queued (data not lost for signed-in user)', pushed.length, 1);
eq('pushed value is the intended value', pushed[0].value, '{"a":1}');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/persist-quota.test.mjs`
Expected: PASS as a self-contained spec of the target behavior (it pins what `persist` must do). Proceed to implement the same logic in `index.html`.

- [ ] **Step 3: Add a non-blocking notice helper + container**

In the header HTML, immediately after `<div class="auth-bar" id="authBar"></div>` (line 1305), add:

```html
          <div class="app-notice" id="appNotice" style="display:none"></div>
```

Add near `safeParse` (after the block inserted in Task 1) this helper:

```javascript
    // Non-blocking, auto-dismissing notice for recoverable problems (e.g. storage full).
    let _noticeTimer = null;
    function showNotice(msg) {
      const el = document.getElementById('appNotice');
      if (!el) return;
      el.textContent = '⚠ ' + msg;
      el.style.display = '';
      if (_noticeTimer) clearTimeout(_noticeTimer);
      _noticeTimer = setTimeout(() => { el.style.display = 'none'; }, 6000);
    }
```

- [ ] **Step 4: Guard `persist` (lines 1693-1698)**

Replace:

```javascript
    function persist(key, value) {
      localStorage.setItem(key, value);
      const m = metaGet(); m[key] = Date.now(); metaSet(m);
      pushKey(key, value, m[key]);
    }
```

with:

```javascript
    function persist(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // Quota exceeded / private mode: don't let the failure break the
        // interaction. Warn the user, and still push to the cloud below so a
        // signed-in user's change isn't lost.
        showNotice('Couldn’t save locally — storage may be full.');
        console.warn('localStorage write failed for ' + key, e);
      }
      const m = metaGet(); m[key] = Date.now(); metaSet(m);
      pushKey(key, value, m[key]);
    }
```

- [ ] **Step 5: Add minimal styling for the notice**

In the CSS block near the `.auth-bar` rule (line 1067), add:

```css
    .app-notice { margin-top: 6px; padding: 6px 10px; border-radius: 8px;
      background: #b91c1c; color: #fff; font-size: 13px; }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node test/persist-quota.test.mjs`
Expected: PASS — `N passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add index.html test/persist-quota.test.mjs
git commit -m "fix: a failed local save warns instead of breaking the app

- guard localStorage.setItem in persist(); show a non-blocking notice
- still push to the cloud so signed-in users don't lose the change"
```

---

### Task 3: Per-section error boundary in `render()`

**Files:**
- Modify: `index.html` — add `safeRender` helper near `render` (line 4165); wrap each sub-render call.
- Test: `test/render-boundary.test.mjs`

**Interfaces:**
- Produces: `safeRender(name, fn)` runs `fn()`; on throw it logs and continues (never re-throws), so one failing section can't halt the others.

- [ ] **Step 1: Write the failing test**

Create `test/render-boundary.test.mjs`:

```javascript
// Verification that one failing section can't blank the whole page.
// Run: node test/render-boundary.test.mjs
//
// Bug: render() called every sub-render in sequence with no try/catch, so a
// throw in one section halted render() and nothing displayed. Fix: safeRender
// isolates each section.

// ---- pure control-flow under test (kept identical to index.html, minus DOM) ----
function safeRender(name, fn, onError) {
  try { fn(); } catch (e) { if (onError) onError(name, e); }
}

// ---- harness ----
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
}

const ran = [];
const errors = [];
const onError = (n) => errors.push(n);

// Simulate render() calling three sections where the middle one throws.
safeRender('a', () => ran.push('a'), onError);
safeRender('b', () => { ran.push('b'); throw new Error('boom'); }, onError);
safeRender('c', () => ran.push('c'), onError);

eq('all three sections were attempted', ran.join(','), 'a,b,c');
eq('the throwing section was recorded', errors.join(','), 'b');
eq('siblings after the failure still ran', ran.includes('c'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it passes as a spec**

Run: `node test/render-boundary.test.mjs`
Expected: PASS — pins `safeRender` semantics before wiring it into `render`.

- [ ] **Step 3: Add `safeRender` and wrap the sub-renders**

Immediately before `function render()` (line 4165), add:

```javascript
    // Isolate each section so a throw in one can't blank the whole page.
    function safeRender(name, fn) {
      try { fn(); }
      catch (e) {
        console.error('render section "' + name + '" failed', e);
        const host = document.getElementById('sec_' + name) || document.getElementById(name);
        if (host) host.insertAdjacentHTML('afterbegin',
          '<div class="app-notice" style="display:block">⚠ Couldn’t load this section.</div>');
      }
    }
```

Replace the body of `render()` (lines 4169-4180) so each call is wrapped:

```javascript
      safeRender('exercises', renderExercises);
      safeRender('cardio', renderCardio);
      safeRender('intake', renderIntake);
      safeRender('measures', renderMeasures);
      safeRender('if', renderIF);
      safeRender('mind', renderMind);
      safeRender('routines', renderRoutines);
      safeRender('timer', refreshTimerUI);
      safeRender('sound', updateSoundBtn);
      safeRender('ntfy', updateNtfyLink);
      safeRender('summaries', updateSectionSummaries);
      safeRender('collapsed', applyCollapsed);
```

(The two lines above the sub-renders — `dateDisplay` text and the `todayBtn` toggle — stay as-is, outside the boundary; they are trivial and a failure there is itself a bug worth surfacing loudly.)

- [ ] **Step 4: Run the test again**

Run: `node test/render-boundary.test.mjs`
Expected: PASS.

- [ ] **Step 5: Manual sanity check (optional but recommended)**

Open `index.html` in a browser, then in the console run `renderMind = () => { throw new Error('x') }; render();`. Expected: the page still renders every other section; only the Mind area shows the inline notice (or logs to console if the host id differs). Reload to restore.

- [ ] **Step 6: Commit**

```bash
git add index.html test/render-boundary.test.mjs
git commit -m "fix: one failing section no longer blanks the whole page

- add safeRender boundary around each sub-render in render()"
```

---

### Task 4: Surface sync health in the auth bar

**Files:**
- Modify: `index.html` — add `syncState` + `nextSyncState` + `setSyncState` near `pushKey` (line 1700); set state in `pushKey` success/catch and in `syncOnLogin`'s upsert; reflect state in `updateAuthBar` (line 1871).
- Test: `test/sync-status.test.mjs`

**Interfaces:**
- Produces: `nextSyncState(ok, online)` → `'synced' | 'offline' | 'error'`.
- Produces: module-level `syncState` string; `setSyncState(s)` updates it and refreshes the auth bar.

- [ ] **Step 1: Write the failing test**

Create `test/sync-status.test.mjs`:

```javascript
// Verification of sync-health state transitions.
// Run: node test/sync-status.test.mjs
//
// Bug: pushKey swallowed every error, so the auth bar always said "Synced" even
// when every cloud write was failing. Fix: derive a sync state from push
// outcomes and show it.

// ---- pure helper under test (kept identical to index.html) ----
function nextSyncState(ok, online) {
  if (ok) return 'synced';
  return online ? 'error' : 'offline';
}

// ---- harness ----
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
}

eq('successful push -> synced', nextSyncState(true, true), 'synced');
eq('successful push while offline flag stale -> still synced', nextSyncState(true, false), 'synced');
eq('failed push while online -> error', nextSyncState(false, true), 'error');
eq('failed push while offline -> offline', nextSyncState(false, false), 'offline');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it passes as a spec**

Run: `node test/sync-status.test.mjs`
Expected: PASS — pins the transition table.

- [ ] **Step 3: Add sync-state plumbing near `pushKey` (line 1700)**

Immediately before `async function pushKey(...)`, add:

```javascript
    // Sync health, shown in the auth bar so a signed-in user can tell whether
    // their writes are actually reaching the cloud. Failed pushes still retry on
    // the next keep-alive; this is visibility only.
    let syncState = 'synced';
    function nextSyncState(ok, online) {
      if (ok) return 'synced';
      return online ? 'error' : 'offline';
    }
    function setSyncState(s) {
      if (s === syncState) return;
      syncState = s;
      updateAuthBar();
    }
```

- [ ] **Step 4: Set state from `pushKey` outcomes (lines 1700-1708)**

Replace:

```javascript
    async function pushKey(key, value, ts) {
      if (!sb || !currentUser || LOCAL_ONLY_KEYS.includes(key)) return;
      try {
        await sb.from('tracker_data').upsert(
          { user_id: currentUser.id, key, value, updated_at: new Date(ts || Date.now()).toISOString() },
          { onConflict: 'user_id,key' }
        );
      } catch (e) { /* offline — resynced on next focus/login */ }
    }
```

with:

```javascript
    async function pushKey(key, value, ts) {
      if (!sb || !currentUser || LOCAL_ONLY_KEYS.includes(key)) return;
      try {
        const { error } = await sb.from('tracker_data').upsert(
          { user_id: currentUser.id, key, value, updated_at: new Date(ts || Date.now()).toISOString() },
          { onConflict: 'user_id,key' }
        );
        setSyncState(nextSyncState(!error, navigator.onLine));
      } catch (e) {
        // Network/transport failure — resynced on next focus/login.
        setSyncState(nextSyncState(false, navigator.onLine));
      }
    }
```

- [ ] **Step 5: Reflect state in `updateAuthBar` (lines 1875-1877)**

Replace the signed-in branch:

```javascript
      if (currentUser) {
        el.innerHTML = `<span class="auth-note">☁ Synced</span>
          <button class="auth-link" onclick="doSignOut()">Sign out</button>`;
      } else {
```

with:

```javascript
      if (currentUser) {
        const label = syncState === 'synced' ? '☁ Synced'
          : syncState === 'offline' ? '⚡ Offline — will retry'
          : '⚠ Sync error — will retry';
        el.innerHTML = `<span class="auth-note" title="Cloud sync status">${label}</span>
          <button class="auth-link" onclick="doSignOut()">Sign out</button>`;
      } else {
```

- [ ] **Step 6: Mark a successful full sync in `syncOnLogin` (line 1814)**

The bulk upsert at line 1814 is `if (toPush.length) { try { await sb.from('tracker_data').upsert(toPush, ...); } catch (e) {} }`. Update its `catch` and add a success path:

```javascript
      if (toPush.length) {
        try { await sb.from('tracker_data').upsert(toPush, { onConflict: 'user_id,key' }); setSyncState('synced'); }
        catch (e) { setSyncState(nextSyncState(false, navigator.onLine)); }
      } else {
        setSyncState('synced'); // a clean pull with nothing to push means we're in sync
      }
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node test/sync-status.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html test/sync-status.test.mjs
git commit -m "feat: auth bar shows real sync health, not always \"Synced\"

- derive synced/offline/error from push outcomes and surface in the auth bar"
```

---

### Task 5: Run the full suite and verify no regressions

**Files:**
- None (verification only).

- [ ] **Step 1: Run every test**

Run:

```bash
for f in test/*.test.mjs; do echo "== $f =="; node "$f" || exit 1; done
```

Expected: every file prints `N passed, 0 failed` and the loop exits 0. The four new tests plus the ten pre-existing tests all pass.

- [ ] **Step 2: Browser smoke test**

Open `index.html`, confirm: the page renders; adding an exercise rep still works and persists across reload; signing in (if configured) shows the sync indicator. Then in the console run `localStorage.setItem('ht_' + new Date().toISOString().slice(0,10), '{broken'); location.reload();` — expected: the app still loads (does not white-screen), and `localStorage` now contains a `__ht_corrupt_*` backup key. Clean up the corrupt key afterward.

- [ ] **Step 3: Confirm clean tree**

Run: `git status` — expected: clean (all four fixes committed), `docs/` plan committed separately if desired.

---

## Self-Review

**Spec coverage:**
- Fix 1 (crash-proof reads) → Task 1. ✓
- Fix 2 (localStorage write failure) → Task 2. ✓
- Fix 3 (render error boundary) → Task 3. ✓
- Fix 4 (surface sync health) → Task 4. ✓
- Four regression tests → one per task; full-suite run → Task 5. ✓
- Spec acceptance criteria are each asserted by a test or a smoke-check step.

**Placeholder scan:** No TBD/TODO; every code step shows complete code and exact commands. ✓

**Type/name consistency:** `safeParse(raw, fallback)`, `getData()`, `persist(key, value)`, `showNotice(msg)`, `safeRender(name, fn)`, `nextSyncState(ok, online)`, `setSyncState(s)`, `syncState` are used identically across tasks and tests. Backup-key prefix `__ht_corrupt_` is consistent in Task 1 code and test. ✓

**Constraint adherence:** No build step, no dependencies; backup/diagnostic keys use the `__ht_` (non-syncing) prefix; happy path unchanged. ✓
