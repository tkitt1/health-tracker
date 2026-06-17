// Verification for the "Total Work" Hour:Min formatter.
// Run: node test/fmt-hm.test.mjs
//
// Whole minutes -> "Hh Mm", always showing the hour part. Mirrors fmtHM() in index.html.

function fmtHM(totalMin) {
  const t = Math.max(0, Math.floor(totalMin) || 0);
  return Math.floor(t / 60) + 'h ' + (t % 60) + 'm';
}

let passed = 0, failed = 0;
function eq(name, got, want) {
  if (got === want) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log(`  ✗ ${name}\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}

eq('zero', fmtHM(0), '0h 0m');
eq('under an hour shows 0h', fmtHM(35), '0h 35m');
eq('exactly one hour', fmtHM(60), '1h 0m');
eq('hours and minutes', fmtHM(214), '3h 34m');
eq('multi-hour round', fmtHM(180), '3h 0m');
eq('floors fractional minutes', fmtHM(34.9), '0h 34m');
eq('negative clamps to zero', fmtHM(-5), '0h 0m');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
