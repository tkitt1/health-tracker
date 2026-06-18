// Verification for the Morning Routine auto-complete logic.
// Run: node test/routines.test.mjs
//
// Rule: complete when the EXERCISE requirement is met AND reading is logged before
// 10am AND meditation is logged before 9am AND the AM journal box is checked.
// The exercise requirement is satisfied by EITHER a single cardio session of
// >=10 minutes before 9am, OR 2+ distinct strength exercises before 9am.
// These helpers mirror the ones in index.html.

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
  const loggedBefore10 = key => hasEntryBetween(key, dayMs(0), dayMs(10));
  const loggedAfter = (key, h) => hasEntryBetween(key, dayMs(h), dayMs(24));
  // A single cardio session (one entry) of at least `mins` minutes before 9am.
  const cardioSessionBefore9 = (key, mins) => getEntries(key).some(e => {
    const t = +e.t || 0;
    return t >= dayMs(0) && t < dayMs(9) && (parseFloat(e.time) || 0) >= mins;
  });
  function sleepTimeOk(str) {
    if (!str) return false;
    const p = String(str).split(':');
    const mins = (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    return mins >= 12 * 60 && mins <= 21 * 60 + 30;
  }
  function morningAuto() {
    const strengthCount = EXERCISES.filter(loggedBefore9).length;
    const cardio10 = CARDIO.some(k => cardioSessionBefore9(k, 10));
    const exerciseReq = cardio10 || strengthCount >= 2;
    return exerciseReq && loggedBefore10('reading') && loggedBefore9('meditation') && !!fields.journal_am;
  }
  function eveningAuto() {
    return !!fields.ptt && loggedAfter('meditation', 19) && loggedAfter('reading', 19)
      && sleepTimeOk(fields.sleep_time) && !!fields.journal_pm && !!fields.prepped_family;
  }
  return { morningAuto, eveningAuto, loggedBefore9, loggedBefore10, loggedAfter, cardioSessionBefore9, sleepTimeOk };
}

// timestamp helper: hour:min local on the viewed day
const D = new Date(2026, 5, 14);
const at = (h, m = 0) => new Date(2026, 5, 14, h, m, 0, 0).getTime();

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got ${got}, want ${want}`); }
}

// 1. Happy path A — 2 strength exercises before 9am (+ reading/meditation/journal).
ok('2 strength exercises + reading + meditation + AM journal -> complete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    squats: [{ t: at(7, 15), v: 30 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), true);

// 1b. Happy path B — a single 10-min cardio session satisfies the exercise requirement.
ok('one 10-min cardio session + reading + meditation + AM journal -> complete',
  makeApi(D, {
    run: [{ t: at(7), time: 10, dist: 2 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), true);

// 1c. Same as 1 but AM journal missing -> incomplete.
ok('all activities but AM journal missing -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    squats: [{ t: at(7, 15), v: 30 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, {}).morningAuto(), false);

// 2. Behavior change: 1 strength + 1 short cardio no longer counts (a mix doesn't add up).
ok('1 strength + 1 short cardio (<10min) -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    run: [{ t: at(7, 30), time: 5, dist: 1 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), false);

// 2b. Cardio just under 10 min, no strength -> incomplete.
ok('9-min cardio session only -> incomplete',
  makeApi(D, {
    run: [{ t: at(7), time: 9, dist: 2 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), false);

// 2c. Two short cardio sessions (6+6) don't combine into a 10-min session -> incomplete.
ok('two short cardio sessions (no single >=10) -> incomplete',
  makeApi(D, {
    run: [{ t: at(7), time: 6, dist: 1 }],
    walk: [{ t: at(7, 30), time: 6, dist: 1 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), false);

// 2d. 10-min cardio AFTER 9am -> doesn't satisfy the requirement.
ok('10-min cardio after 9am -> incomplete',
  makeApi(D, {
    run: [{ t: at(10), time: 20, dist: 4 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), false);

// 3. Single strength exercise only -> incomplete.
ok('only 1 strength exercise -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), false);

// 4. Missing meditation -> incomplete (exercise requirement met, so meditation is the decider).
ok('missing meditation -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    squats: [{ t: at(7, 15), v: 30 }],
    reading: [{ t: at(8), v: 15 }],
  }, { journal_am: true }).morningAuto(), false);

// 4b. Reading at 9:30am (after 9, before 10) now counts -> complete.
ok('reading at 9:30am counts (10am cutoff) -> complete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    squats: [{ t: at(7, 15), v: 30 }],
    reading: [{ t: at(9, 30), v: 15 }],
    meditation: [{ t: at(8, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), true);

// 4c. Reading at exactly 10am does NOT count.
ok('reading at 10:00am excluded',
  makeApi(D, { reading: [{ t: at(10), v: 15 }] }).loggedBefore10('reading'), false);
ok('reading at 9:59am counts',
  makeApi(D, { reading: [{ t: at(9, 59), v: 15 }] }).loggedBefore10('reading'), true);

// 4d. Meditation cutoff stays 9am: meditation at 9:30 does NOT count -> incomplete.
ok('meditation at 9:30am still excluded (9am cutoff) -> incomplete',
  makeApi(D, {
    pushups: [{ t: at(7), v: 20 }],
    squats: [{ t: at(7, 15), v: 30 }],
    reading: [{ t: at(8), v: 15 }],
    meditation: [{ t: at(9, 30), v: 10 }],
  }, { journal_am: true }).morningAuto(), false);

// --- unit checks ---

// 5. cardioSessionBefore9 thresholds.
ok('cardioSessionBefore9: 10-min session counts',
  makeApi(D, { run: [{ t: at(7), time: 10, dist: 1 }] }).cardioSessionBefore9('run', 10), true);
ok('cardioSessionBefore9: 9-min session does not',
  makeApi(D, { run: [{ t: at(7), time: 9, dist: 1 }] }).cardioSessionBefore9('run', 10), false);
ok('cardioSessionBefore9: 10-min after 9am does not',
  makeApi(D, { run: [{ t: at(10), time: 10, dist: 1 }] }).cardioSessionBefore9('run', 10), false);

// 6. Exactly 9:00:00 does NOT count (cutoff is strictly before 9am).
ok('entry at exactly 09:00 excluded',
  makeApi(D, { pushups: [{ t: at(9), v: 20 }] }).loggedBefore9('pushups'), false);
ok('entry at 08:59 counts',
  makeApi(D, { pushups: [{ t: at(8, 59), v: 20 }] }).loggedBefore9('pushups'), true);

// 7. Legacy entry (t=0) never counts.
ok('legacy t=0 excluded',
  makeApi(D, { reading: [{ t: 0, v: 30 }] }).loggedBefore9('reading'), false);

// 8. Zero-value entry before 9am does not count.
ok('zero-value entry excluded',
  makeApi(D, { pushups: [{ t: at(7), v: 0 }] }).loggedBefore9('pushups'), false);

// --- Evening routine ---
const eveStore = {
  meditation: [{ t: at(20), v: 10 }],   // 8pm
  reading: [{ t: at(21), v: 20 }],      // 9pm
};
const eveFields = { ptt: true, journal_pm: true, prepped_family: true, sleep_time: '21:15' };

// 9. All evening conditions met -> complete.
ok('all evening conditions met -> complete',
  makeApi(D, eveStore, eveFields).eveningAuto(), true);

// 10. Meditation before 7pm does not count for evening.
ok('meditation before 7pm -> not counted',
  makeApi(D, { meditation: [{ t: at(18, 59), v: 10 }] }, {}).loggedAfter('meditation', 19), false);
ok('meditation at exactly 7pm counts',
  makeApi(D, { meditation: [{ t: at(19), v: 10 }] }, {}).loggedAfter('meditation', 19), true);

// 11. Sleep time thresholds (<= 21:30 inclusive; past-midnight fails).
const api = makeApi(D, {}, {});
ok('sleep 21:30 ok', api.sleepTimeOk('21:30'), true);
ok('sleep 21:31 not ok', api.sleepTimeOk('21:31'), false);
ok('sleep 00:30 (after midnight) not ok', api.sleepTimeOk('00:30'), false);
ok('sleep empty not ok', api.sleepTimeOk(''), false);

// 12. Missing one evening field -> incomplete.
ok('evening missing PTT -> incomplete',
  makeApi(D, eveStore, { ...eveFields, ptt: false }).eveningAuto(), false);
ok('evening missing prepped-for-family -> incomplete',
  makeApi(D, eveStore, { ...eveFields, prepped_family: false }).eveningAuto(), false);
ok('evening late bedtime -> incomplete',
  makeApi(D, eveStore, { ...eveFields, sleep_time: '22:00' }).eveningAuto(), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
