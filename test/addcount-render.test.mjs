// Verification for the "value doesn't show until refresh" bug on Measures cards.
// Run: node test/addcount-render.test.mjs
//
// Bug: addCount updates the total IN PLACE via the tv_<key> / el_<key> elements
// (so the input keeps focus for rep-after-rep logging). Exercises/Intake/Mind
// cards have those ids. But SIMPLE_MEASURES cards reuse addCount and (a) have no
// tv_/el_ ids and (b) display the LATEST reading, not a running sum. So the
// in-place update silently no-ops and the displayed value is stale until a full
// page reload re-runs render().
//
// Fix: when a card has no in-place total element (tv_<key>), addCount must fall
// back to a full render() so the card reflects the new value immediately.

// ---- fake DOM: only the elements a given card type actually renders ----
function makeDoc(ids) {
  const els = {};
  for (const id of ids) els[id] = { value: '', textContent: '', focus() {} };
  return { getElementById: id => els[id] || null, _els: els };
}

// ---- logic under test (kept identical to addCount in index.html) ----
// Injected deps mirror the module-scope helpers index.html closes over.
function makeAddCount({ document, store, onRender }) {
  let nextId = 1;
  const genId = () => 'id' + nextId++;
  const round = n => Math.round(n * 100) / 100;
  const getEntries = key => store[key] || (store[key] = []);
  const setEntries = (key, arr) => { store[key] = arr; };
  const sumEntries = key => round(getEntries(key).reduce((s, e) => s + (parseFloat(e.v) || 0), 0));
  const render = () => onRender();
  const renderRoutines = () => {};
  const updateSectionSummaries = () => {};

  return function addCount(key) {
    const el = document.getElementById(key + '_in');
    const v = parseFloat(el.value) || 0;
    if (v <= 0) return;
    const entry = { id: genId(), t: 0, v: round(v) };
    const itemEl = document.getElementById(key + '_item_in');
    if (itemEl && itemEl.value.trim()) entry.item = itemEl.value.trim();
    const arr = getEntries(key);
    arr.push(entry);
    setEntries(key, arr);
    const tv = document.getElementById('tv_' + key);
    if (!tv) {
      // Cards without an in-place total (e.g. Measures show the latest reading,
      // not a running sum) need a full re-render to reflect the new value.
      el.value = '';
      if (itemEl) itemEl.value = '';
      render();
      return;
    }
    // Update in place (don't rebuild the card) so the input keeps focus and the
    // mobile keyboard stays up — you can log rep after rep without re-tapping.
    el.value = '';
    if (itemEl) itemEl.value = '';
    tv.textContent = sumEntries(key);
    const elk = document.getElementById('el_' + key);
    if (elk) elk.textContent = 'edit (' + arr.length + ')';
    renderRoutines();
    updateSectionSummaries();
    el.focus();
  };
}

// ---- tiny test harness ----
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Accumulating card (Exercise): has tv_/el_ -> updates in place, no full render.
test('exercise card updates total in place without a full render', () => {
  const store = {};
  let renders = 0;
  const document = makeDoc(['pushups_in', 'tv_pushups', 'el_pushups']);
  const addCount = makeAddCount({ document, store, onRender: () => renders++ });
  document.getElementById('pushups_in').value = '10';
  addCount('pushups');
  assert(document.getElementById('tv_pushups').textContent === 10, 'in-place total should be 10');
  assert(renders === 0, 'accumulating card should not trigger a full render');
});

// Measure card (Weight): no tv_/el_ -> MUST fall back to a full render so the
// new value shows immediately (this is the bug that required a refresh).
test('measure card with no in-place total triggers a full render', () => {
  const store = {};
  let renders = 0;
  const document = makeDoc(['weight_in']); // note: NO tv_weight / el_weight
  const addCount = makeAddCount({ document, store, onRender: () => renders++ });
  document.getElementById('weight_in').value = '82.5';
  addCount('weight');
  assert(store.weight.length === 1 && store.weight[0].v === 82.5, 'entry should be saved');
  assert(renders === 1, 'measure card MUST trigger a full render so the value shows without a refresh');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
