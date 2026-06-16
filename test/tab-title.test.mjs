// Verification for the browser-tab running-clock title.
// Run: node test/tab-title.test.mjs
//
// The tab title mirrors the live work timer: "MM:SS · Work" / "MM:SS · Break"
// while running, "MM:SS · Paused" when paused (started but not running), and the
// plain app name when idle/ended. This mirrors tabTitleFor() in index.html.

function tabTitleFor(s) {
  if (s.running) return s.timeStr + ' · ' + (s.phase === 'work' ? 'Work' : 'Break');
  if (s.started) return s.timeStr + ' · Paused';
  return 'My Performance Tracker';
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); failed++; }
}
function eq(a, b) { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

test('running work period shows time + Work', () => {
  eq(tabTitleFor({ running: true, started: true, phase: 'work', timeStr: '24:13' }), '24:13 · Work');
});
test('running short break shows time + Break', () => {
  eq(tabTitleFor({ running: true, started: true, phase: 'short-break', timeStr: '03:12' }), '03:12 · Break');
});
test('running long break also shows Break', () => {
  eq(tabTitleFor({ running: true, started: true, phase: 'long-break', timeStr: '12:00' }), '12:00 · Break');
});
test('paused (started, not running) shows Paused', () => {
  eq(tabTitleFor({ running: false, started: true, phase: 'work', timeStr: '24:13' }), '24:13 · Paused');
});
test('not started shows plain app name', () => {
  eq(tabTitleFor({ running: false, started: false, phase: 'work', timeStr: '30:00' }), 'My Performance Tracker');
});
test('ended (running false, started false) shows plain app name', () => {
  eq(tabTitleFor({ running: false, started: false, phase: 'work', timeStr: '30:00' }), 'My Performance Tracker');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
