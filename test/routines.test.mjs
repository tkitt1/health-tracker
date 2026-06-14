// Verification for the Morning Routine auto-complete logic.
// Run: node test/routines.test.mjs
//
// Rule: complete when >=2 distinct exercise/cardio items AND reading AND
// meditation each have a real entry (value > 0) timestamped before 9am local
// on the viewed day. These helpers mirror the ones in index.html.

const EXERCISES = ['pushups','squats','pullups','dips','deadhang','kettlebell','sprints','jumprope'];
const CARDIO = ['bike','run','walk','swim'];

// --- logic under test (kept identical to index.html) ---
function makeApi(currentDate, store, fields = {}) {
  const dayMs = (h, m) => new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), h || 0, m || 0, 0, 0).getTime();
  const getEntries = key => store[key] || [];
  function hasEntryBetween(key, from, to) {
    return getEntries(key).some(e => {
      const t = +e.t || 0;
      if (t < from || t >= to) return false;
      const val = (e.v != null && e.v !== '') ? parseFloat(e.v)
        : (parseFloat(e.time) || 0) + (parseFloat(e.dist) || 0);
      return (parseFloat(val) || 0) > 0;
    });
  }
  const loggedBefore9 = key => hasEntryBetween(key, dayMs(0), dayMs(9));
  const loggedAfter = (key, h) => hasEntryBetween(key, dayMs(h), dayMs(24));
  function sleepTimeOk(str) {
    if (!str) return false;
    const p = String(str).split(':');
    const mins = (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    return mins >= 12 * 60 && mins <= 21 * 60 + 30;
  }
  function morningAuto() {
    const pool = [...EXERCISES, ...CARDIO];
    const exCount = pool.filter(loggedBefore9).length;
    return exCount >= 2 && loggedBefore9('reading') && loggedBefore9('meditation') && !!fields.journal_am;
  }
  function eveningAuto() {
    return !!fields.ptt && loggedAfter('meditation', 19) && loggedAfter('reading', 19)
      && sleepTimeOk(fields.sleep_time) && !!fields.journal_pm && !!fields.prepped_family;
  }
  return { morningAuto, eveningAuto, loggedBefore9, loggedAfter, sleepTimeOk };
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
  }, { journal_am: true }).morningAuto(), true);

// 1b. Same but AM journal not done -> incomplete.
ok('all activities but AM journal missing -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    run: [{ t: at(7, 30), time: 5, dist: 1 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, {}).morningAuto(), false);

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
  }, { journal_am: true }).morningAuto(), true);

// --- Evening routine ---
const eveStore = {
  meditation: [{ t: at(20), v: 10 }],   // 8pm
  reading: [{ t: at(21), v: 20 }],      // 9pm
};
const eveFields = { ptt: true, journal_pm: true, prepped_family: true, sleep_time: '21:15' };

// 10. All evening conditions met -> complete.
ok('all evening conditions met -> complete',
  makeApi(D, eveStore, eveFields).eveningAuto(), true);

// 11. Meditation before 7pm does not count for evening.
ok('meditation before 7pm -> not counted',
  makeApi(D, { meditation: [{ t: at(18, 59), v: 10 }] }, {}).loggedAfter('meditation', 19), false);
ok('meditation at exactly 7pm counts',
  makeApi(D, { meditation: [{ t: at(19), v: 10 }] }, {}).loggedAfter('meditation', 19), true);

// 12. Sleep time thresholds (<= 21:30 inclusive; past-midnight fails).
const api = makeApi(D, {}, {});
ok('sleep 21:30 ok', api.sleepTimeOk('21:30'), true);
ok('sleep 21:31 not ok', api.sleepTimeOk('21:31'), false);
ok('sleep 00:30 (after midnight) not ok', api.sleepTimeOk('00:30'), false);
ok('sleep empty not ok', api.sleepTimeOk(''), false);

// 13. Missing one evening field -> incomplete.
ok('evening missing PTT -> incomplete',
  makeApi(D, eveStore, { ...eveFields, ptt: false }).eveningAuto(), false);
ok('evening missing prepped-for-family -> incomplete',
  makeApi(D, eveStore, { ...eveFields, prepped_family: false }).eveningAuto(), false);
ok('evening late bedtime -> incomplete',
  makeApi(D, eveStore, { ...eveFields, sleep_time: '22:00' }).eveningAuto(), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
