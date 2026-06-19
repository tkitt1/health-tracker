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
