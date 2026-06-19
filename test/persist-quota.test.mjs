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
