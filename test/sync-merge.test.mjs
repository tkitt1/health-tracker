// Verification for entry-level merge of day records across devices.
// Run: node test/sync-merge.test.mjs
//
// Bug: a day's record (ht_<date>) synced as one blob, newest-write-wins. When two
// devices edited the same day, the later writer's blob overwrote the other device's
// entire day — e.g. pushups/squats logged on a phone were dropped once the desktop
// (whose work timer constantly re-saves today) pushed its newer blob.
//
// Fix: merge day records by entry id (union the per-metric arrays), take scalars from
// the newer blob, and keep the earliest work_started_at. These mirror index.html.

const isDayRecord = k => /^ht_\d{4}-\d{2}-\d{2}$/.test(k);
function earliestStart(aStr, bStr) {
  const get = s => { try { const v = JSON.parse(s || '{}').work_started_at; return (typeof v === 'number' && v > 0) ? v : 0; } catch (e) { return 0; } };
  const a = get(aStr), b = get(bStr);
  if (a && b) return Math.min(a, b);
  return a || b;
}
function dayEntryKey(e) { return (e && e.id != null) ? 'id:' + e.id : 'j:' + JSON.stringify(e); }
function unionEntries(newerArr, olderArr) {
  const map = new Map();
  (olderArr || []).forEach(e => map.set(dayEntryKey(e), e));
  (newerArr || []).forEach(e => map.set(dayEntryKey(e), e)); // newer wins an id collision
  return Array.from(map.values()).sort((a, b) => (+a.t || 0) - (+b.t || 0) || String(a && a.id).localeCompare(String(b && b.id)));
}
function mergeDayRecords(localStr, remoteStr, remoteNewer) {
  let L = {}, R = {};
  try { L = JSON.parse(localStr || '{}') || {}; } catch (e) {}
  try { R = JSON.parse(remoteStr || '{}') || {}; } catch (e) {}
  const newer = remoteNewer ? R : L, older = remoteNewer ? L : R;
  const out = {};
  [...new Set([...Object.keys(L), ...Object.keys(R)])].sort().forEach(k => {
    const lv = L[k], rv = R[k];
    if (Array.isArray(lv) || Array.isArray(rv)) {
      const la = Array.isArray(lv) ? lv : [], ra = Array.isArray(rv) ? rv : [];
      out[k] = unionEntries(remoteNewer ? ra : la, remoteNewer ? la : ra);
    } else {
      out[k] = (newer[k] !== undefined) ? newer[k] : older[k];
    }
  });
  const es = earliestStart(localStr, remoteStr);
  if (es) out.work_started_at = es;
  return JSON.stringify(out);
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓ ' + name); passed++; } catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const phone   = JSON.stringify({ pushups: [{ id: 'p1', t: 100, v: 20 }], squats: [{ id: 's1', t: 101, v: 30 }] });
const desktop = JSON.stringify({ coffee: [{ id: 'c1', t: 90, v: 1 }], timer_periods: 6, timer_total_work: 10800 });

test('THE BUG: desktop newer must still keep the phone pushups/squats', () => {
  const m = JSON.parse(mergeDayRecords(desktop, phone, /*remoteNewer=*/false));
  assert(m.pushups && m.pushups.length === 1 && m.pushups[0].v === 20, 'pushups preserved');
  assert(m.squats && m.squats.length === 1, 'squats preserved');
  assert(m.coffee && m.coffee.length === 1, 'desktop coffee preserved');
  assert(m.timer_periods === 6, 'desktop scalar (newer) kept');
});

test('symmetric: phone newer also yields the full union', () => {
  const m = JSON.parse(mergeDayRecords(desktop, phone, /*remoteNewer=*/true));
  assert(m.pushups && m.squats && m.coffee, 'all metrics present');
});

test('same entry id on both sides is not duplicated', () => {
  const a = JSON.stringify({ pushups: [{ id: 'p1', t: 100, v: 20 }] });
  const b = JSON.stringify({ pushups: [{ id: 'p1', t: 100, v: 20 }, { id: 'p2', t: 105, v: 5 }] });
  const m = JSON.parse(mergeDayRecords(a, b, true));
  assert(m.pushups.length === 2, 'p1 deduped, p2 added -> 2 entries, got ' + m.pushups.length);
});

test('two different entries in the same metric both survive', () => {
  const a = JSON.stringify({ pushups: [{ id: 'p1', t: 100, v: 20 }] });
  const b = JSON.stringify({ pushups: [{ id: 'p2', t: 105, v: 30 }] });
  const m = JSON.parse(mergeDayRecords(a, b, false));
  assert(m.pushups.length === 2, 'both pushup entries kept');
});

test('work_started_at keeps the earliest across devices', () => {
  const a = JSON.stringify({ work_started_at: 5000 });
  const b = JSON.stringify({ work_started_at: 2000 });
  const m = JSON.parse(mergeDayRecords(a, b, true));
  assert(m.work_started_at === 2000, 'earliest start wins');
});

test('canonical output: array union identical regardless of which side is newer', () => {
  const mA = JSON.parse(mergeDayRecords(desktop, phone, true)).pushups;
  const mB = JSON.parse(mergeDayRecords(desktop, phone, false)).pushups;
  assert(JSON.stringify(mA) === JSON.stringify(mB), 'union is order-stable');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
