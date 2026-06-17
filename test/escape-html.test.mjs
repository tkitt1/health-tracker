// Verification for the HTML-escaping helper used on all user-entered text before
// it is interpolated into innerHTML. Mirrors escapeHtml() in index.html.
// Run: node test/escape-html.test.mjs

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let passed = 0, failed = 0;
function eq(name, got, want) {
  if (got === want) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log(`  ✗ ${name}\n      got ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); }
}

eq('plain text unchanged', escapeHtml('Excited'), 'Excited');
eq('emoji preserved', escapeHtml('🎉 Hyped'), '🎉 Hyped');
eq('ampersand', escapeHtml('R&D'), 'R&amp;D');
eq('angle brackets', escapeHtml('a < b > c'), 'a &lt; b &gt; c');
eq('double quote', escapeHtml('say "hi"'), 'say &quot;hi&quot;');
eq('single quote', escapeHtml("it's"), 'it&#39;s');
eq('null -> empty', escapeHtml(null), '');
eq('undefined -> empty', escapeHtml(undefined), '');
eq('number coerced', escapeHtml(42), '42');

// The exact payloads that would break out of an <option> / attribute today.
eq('neutralizes option-breakout payload',
  escapeHtml('</option><img src=x onerror=alert(1)>'),
  '&lt;/option&gt;&lt;img src=x onerror=alert(1)&gt;');
eq('neutralizes attribute-breakout payload',
  escapeHtml('" onmouseover="alert(1)'),
  '&quot; onmouseover=&quot;alert(1)');
eq('escaped output contains no live < or "',
  /[<>"']/.test(escapeHtml('<svg onload=alert(1)>')), false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
