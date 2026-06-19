// Verification that one failing section can't blank the whole page.
// Run: node test/render-boundary.test.mjs
//
// Bug: render() called every sub-render in sequence with no try/catch, so a
// throw in one section halted render() and nothing displayed. Fix: safeRender
// isolates each section.

// ---- pure control-flow under test (kept identical to index.html, minus DOM) ----
function safeRender(name, fn, onError) {
  try { fn(); } catch (e) { if (onError) onError(name, e); }
}

// ---- harness ----
let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
}

const ran = [];
const errors = [];
const onError = (n) => errors.push(n);

// Simulate render() calling three sections where the middle one throws.
safeRender('a', () => ran.push('a'), onError);
safeRender('b', () => { ran.push('b'); throw new Error('boom'); }, onError);
safeRender('c', () => ran.push('c'), onError);

eq('all three sections were attempted', ran.join(','), 'a,b,c');
eq('the throwing section was recorded', errors.join(','), 'b');
eq('siblings after the failure still ran', ran.includes('c'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
