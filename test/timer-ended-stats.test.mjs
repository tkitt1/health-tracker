// Verification for the Work Timer stats after "End Day".
// Run: node test/timer-ended-stats.test.mjs
//
// Bug: End Day zeroes the live counters (t.periods/t.workSeconds) for the next
// session, so the WORK PERIODS and TOTAL WORK cells showed 0 even though the day
// logged work. When ended, show the day's final values (endedPeriods + the
// recorded total) instead. Mirrors displayTimerStats() in index.html.

function displayTimerStats(t, recordedSec, recordedPeriods, liveSec) {
  const ended = t.dayEnded && !t.running && !t.started;
  return ended
    ? { periods: t.endedPeriods || recordedPeriods || 0, workSec: recordedSec || 0 }
    : { periods: t.periods || 0, workSec: liveSec };
}

let passed = 0, failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log(`  ✗ ${name}\n      got ${g}, want ${w}`); }
}

// Running: show live values.
eq('running -> live values',
  displayTimerStats({ running: true, started: true, dayEnded: false, periods: 3 }, 0, 0, 5400),
  { periods: 3, workSec: 5400 });

// Paused (started, not running): still live.
eq('paused -> live values',
  displayTimerStats({ running: false, started: true, dayEnded: false, periods: 5, workSeconds: 9000 }, 0, 0, 9000),
  { periods: 5, workSec: 9000 });

// THE BUG: ended day with zeroed live counters -> show endedPeriods + recorded total.
eq('ended -> recorded values (not zeroed live)',
  displayTimerStats({ running: false, started: false, dayEnded: true, periods: 0, endedPeriods: 14 }, 14 * 30 * 60, 14, 0),
  { periods: 14, workSec: 25200 });

// Ended but legacy timer without endedPeriods -> fall back to the recorded count.
eq('ended legacy -> recorded periods fallback',
  displayTimerStats({ running: false, started: false, dayEnded: true, periods: 0, endedPeriods: 0 }, 3600, 6, 0),
  { periods: 6, workSec: 3600 });

// Fresh day, nothing logged -> zeros.
eq('fresh -> zeros',
  displayTimerStats({ running: false, started: false, dayEnded: false, periods: 0 }, 0, 0, 0),
  { periods: 0, workSec: 0 });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
