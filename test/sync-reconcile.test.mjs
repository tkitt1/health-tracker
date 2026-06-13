// Verification for the cross-device work-start-time clobber fix.
// Run: node test/sync-reconcile.test.mjs
//
// Bug: a day's record (ht_<date>) syncs as one blob, newest-write-wins, no field
// merge. If a second device writes the day without work_started_at, pulling that
// newer blob wipes the start time, and the next Start re-stamps it — so the work
// start time "changes" mid-day. Fix: preserve the earliest work_started_at across
// local+remote when reconciling a day record.

// ---- pure helpers under test (kept identical to the copies in index.html) ----
const isDayRecord = k => /^ht_\d{4}-\d{2}-\d{2}$/.test(k);

function earliestStart(aStr, bStr) {
  const get = s => {
    try { const v = JSON.parse(s || '{}').work_started_at; return (typeof v === 'number' && v > 0) ? v : 0; }
    catch (e) { return 0; }
  };
  const a = get(aStr), b = get(bStr);
  if (a && b) return Math.min(a, b);
  return a || b; // whichever exists, else 0
}

function withStart(str, start) {
  if (!start) return str;
  let d = {}; try { d = JSON.parse(str || '{}'); } catch (e) {}
  if (d.work_started_at === start) return str;
  d.work_started_at = start;
  return JSON.stringify(d);
}

// The merge as it would run in syncOnLogin for one key. Returns the value that
// ends up stored locally. (We only assert the stored value here.)
function reconciledLocalValue(key, localStr, remoteStr, remoteNewer) {
  const day = isDayRecord(key);
  const keep = day ? earliestStart(localStr, remoteStr) : 0;
  if (remoteNewer) {
    return day ? withStart(remoteStr, keep) : remoteStr;     // remote wins, but keep earliest start
  }
  return day ? withStart(localStr, keep) : localStr;          // local wins, but fold in earlier remote start
}

// The OLD behavior, for contrast (plain overwrite when remote is newer).
function naiveLocalValue(key, localStr, remoteStr, remoteNewer) {
  return remoteNewer ? remoteStr : localStr;
}

// ---- tiny assert harness ----
let pass = 0, fail = 0;
const startOf = s => { try { return JSON.parse(s).work_started_at; } catch (e) { return undefined; } };
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
}

const KEY = 'ht_2026-06-13';
const local9 = JSON.stringify({ work_started_at: 9 * 3600000, calories: [{ id: 'a', t: 1, v: 200 }] });
const remoteNoStartNewer = JSON.stringify({ calories: [{ id: 'a', t: 1, v: 200 }], protein: [{ id: 'b', t: 2, v: 30 }] });

console.log('Bug reproduction (old newest-wins overwrite):');
eq('naive: newer remote without start WIPES the 9:00 stamp (the bug)',
  startOf(naiveLocalValue(KEY, local9, remoteNoStartNewer, true)), undefined);

console.log('\nFix (reconcile preserves earliest start):');
// 1. The reported bug: other device pushed a newer blob lacking the start time.
eq('remote newer & missing start -> keep local 9:00',
  startOf(reconciledLocalValue(KEY, local9, remoteNoStartNewer, true)), 9 * 3600000);

// 2. Local lacks start, remote (winner) has it -> keep remote's.
eq('remote newer & has start, local missing -> keep remote start',
  startOf(reconciledLocalValue(KEY, JSON.stringify({ calories: [] }),
    JSON.stringify({ work_started_at: 8 * 3600000 }), true)), 8 * 3600000);

// 3. Both have a start at different times -> earliest wins, regardless of who is newer.
eq('both have start, remote newer -> earliest (8:30) wins',
  startOf(reconciledLocalValue(KEY, JSON.stringify({ work_started_at: 9 * 3600000 }),
    JSON.stringify({ work_started_at: 8.5 * 3600000 }), true)), 8.5 * 3600000);
eq('both have start, local newer -> earliest (8:30) wins',
  startOf(reconciledLocalValue(KEY, JSON.stringify({ work_started_at: 9 * 3600000 }),
    JSON.stringify({ work_started_at: 8.5 * 3600000 }), false)), 8.5 * 3600000);

// 4. Local wins but remote knew an earlier start -> fold it in.
eq('local newer & missing start, remote has earlier -> adopt remote 8:00',
  startOf(reconciledLocalValue(KEY, JSON.stringify({ calories: [] }),
    JSON.stringify({ work_started_at: 8 * 3600000 }), false)), 8 * 3600000);

// 5. Neither has a start -> stays unset (no spurious stamp).
eq('neither has start -> undefined',
  startOf(reconciledLocalValue(KEY, JSON.stringify({ calories: [] }), JSON.stringify({}), true)), undefined);

// 6. Non-day keys (e.g. ht_timer) are untouched by the merge.
eq('non-day key passes remote through unchanged',
  reconciledLocalValue('ht_timer', '{"a":1}', '{"a":2}', true), '{"a":2}');
eq('non-day key passes local through unchanged',
  reconciledLocalValue('ht_timer', '{"a":1}', '{"a":2}', false), '{"a":1}');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
