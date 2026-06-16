// Verification for the past-day work-timer view.
// Run: node test/timer-pastday.test.mjs
//
// When viewing a past day, the Work Timer shows that day's RECORDED periods/total
// (no live clock). This mirrors pastTimerPhaseText() and the date-aware summary
// selection in index.html.

function pastTimerPhaseText(periods, totalMin) {
  return periods
    ? `✓ ${periods} work period${periods === 1 ? '' : 's'} · ${totalMin}m`
    : 'No work logged this day';
}

// Source-of-truth selection for the section summary: live counters today, stored on past days.
function timerSummary(isToday, live, stored) {
  const src = isToday ? live : stored;
  return (src.periods || 0) + ' periods · ' + Math.floor((src.workSeconds || 0) / 60) + 'm';
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); failed++; }
}
function eq(a, b) { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

test('phase text: multiple periods (plural)', () => {
  eq(pastTimerPhaseText(6, 180), '✓ 6 work periods · 180m');
});
test('phase text: single period (singular)', () => {
  eq(pastTimerPhaseText(1, 30), '✓ 1 work period · 30m');
});
test('phase text: no work logged', () => {
  eq(pastTimerPhaseText(0, 0), 'No work logged this day');
});
test('summary today uses live counters', () => {
  eq(timerSummary(true, { periods: 6, workSeconds: 11220 }, { periods: 2, workSeconds: 3600 }), '6 periods · 187m');
});
test('summary past day uses stored values', () => {
  eq(timerSummary(false, { periods: 6, workSeconds: 11220 }, { periods: 2, workSeconds: 3600 }), '2 periods · 60m');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
