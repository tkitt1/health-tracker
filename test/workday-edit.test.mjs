// Verification for editing the past-day work start time.
// Run: node test/workday-edit.test.mjs
//
// setPastStart parses a datetime-local string and ignores blank/invalid input
// (so a cleared/garbled field never overwrites the stored start). Mirrors
// parseLocalDateTime() in index.html.

function parseLocalDateTime(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return isNaN(ms) ? null : ms;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('valid datetime-local parses to the matching epoch ms', () => {
  const ms = parseLocalDateTime('2026-06-14T09:30');
  assert(ms === new Date(2026, 5, 14, 9, 30, 0, 0).getTime(), 'should equal local Jun 14 2026 09:30');
});
test('empty string returns null (no overwrite)', () => {
  assert(parseLocalDateTime('') === null, 'empty -> null');
});
test('undefined returns null', () => {
  assert(parseLocalDateTime(undefined) === null, 'undefined -> null');
});
test('garbage returns null', () => {
  assert(parseLocalDateTime('not-a-date') === null, 'garbage -> null');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
