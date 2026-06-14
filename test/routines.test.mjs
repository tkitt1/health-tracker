// Verification for the Morning Routine auto-complete logic.
// Run: node test/routines.test.mjs
//
// Rule: complete when >=2 distinct exercise/cardio items AND reading AND
// meditation each have a real entry (value > 0) timestamped before 9am local
// on the viewed day. These helpers mirror the ones in index.html.

const EXERCISES = ['pushups','squats','pullups','dips','deadhang','kettlebell','sprints','jumprope'];
const CARDIO = ['bike','run','walk','swim'];

// --- logic under test (kept identical to index.html) ---
function makeApi(currentDate, store, journalAm = false) {
  function dayBounds() {
    const d = currentDate;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const cut = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0).getTime();
    return { start, cut };
  }
  const getEntries = key => store[key] || [];
  function loggedBefore9(key) {
    const { start, cut } = dayBounds();
    return getEntries(key).some(e => {
      const t = +e.t || 0;
      if (t < start || t >= cut) return false;
      const val = (e.v != null && e.v !== '') ? parseFloat(e.v)
        : (parseFloat(e.time) || 0) + (parseFloat(e.dist) || 0);
      return (parseFloat(val) || 0) > 0;
    });
  }
  function morningAuto() {
    const pool = [...EXERCISES, ...CARDIO];
    const exCount = pool.filter(loggedBefore9).length;
    // AM journal is a checkbox (no timestamp) -> just must be checked.
    return exCount >= 2 && loggedBefore9('reading') && loggedBefore9('meditation') && !!journalAm;
  }
  return { morningAuto, loggedBefore9 };
}

// timestamp helper: hour:min local on the viewed day
const D = new Date(2026, 5, 14);
const at = (h, m = 0) => new Date(2026, 5, 14, h, m, 0, 0).getTime();

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got ${got}, want ${want}`); }
}

// 1. Happy path: 2 distinct activities + reading + meditation + AM journal.
ok('2 ex/cardio + reading + meditation + AM journal -> complete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    run: [{ t: at(7, 30), time: 5, dist: 1 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, true).morningAuto(), true);

// 1b. Same but AM journal not done -> incomplete.
ok('all activities but AM journal missing -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    run: [{ t: at(7, 30), time: 5, dist: 1 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, false).morningAuto(), false);

// 2. Only 1 activity before 9am -> incomplete.
ok('only 1 ex/cardio -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }).morningAuto(), false);

// 3. Missing meditation -> incomplete.
ok('missing meditation -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    run: [{ t: at(7), time: 5, dist: 1 }],
    reading: [{ t: at(8), v: 15 }],
  }).morningAuto(), false);

// 4. Everything logged but AFTER 9am -> incomplete.
ok('all logged after 9am -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(10), v: 20 }],
    run: [{ t: at(10), time: 5, dist: 1 }],
    reading: [{ t: at(10), v: 15 }],
    meditation: [{ t: at(10), v: 10 }],
  }).morningAuto(), false);

// 5. Exactly 9:00:00 does NOT count (cutoff is strictly before 9am).
ok('entry at exactly 09:00 excluded',
  makeApi(D, { pushups: [{ t: at(9), v: 20 }] }).loggedBefore9('pushups'), false);
ok('entry at 08:59 counts',
  makeApi(D, { pushups: [{ t: at(8, 59), v: 20 }] }).loggedBefore9('pushups'), true);

// 6. Legacy entry (t=0) never counts.
ok('legacy t=0 excluded',
  makeApi(D, { reading: [{ t: 0, v: 30 }] }).loggedBefore9('reading'), false);

// 7. Zero-value entry before 9am does not count.
ok('zero-value entry excluded',
  makeApi(D, { pushups: [{ t: at(7), v: 0 }] }).loggedBefore9('pushups'), false);

// 8. Cardio counts on distance-only (no time) and time-only.
ok('cardio distance-only counts',
  makeApi(D, { walk: [{ t: at(7), time: 0, dist: 2 }] }).loggedBefore9('walk'), true);

// 9. Two cardio items (no exercises) satisfy the "2 of exercise OR cardio" pool.
ok('two cardio items + reading + meditation + AM journal -> complete',
  makeApi(D, {
    run: [{ t: at(7), time: 5, dist: 1 }],
    swim: [{ t: at(7, 30), time: 10, dist: 200 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8), v: 10 }],
  }, true).morningAuto(), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
