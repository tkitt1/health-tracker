// Supabase Edge Function: health-import
// Receives Apple Health readings (from an iOS Shortcut) and merges them into the
// tracker's per-day data WITHOUT overwriting anything else on that day.
//
// Deploy: Supabase Dashboard → Edge Functions → Create function "health-import" → paste this.
// Secrets to set (Edge Functions → Manage secrets):
//   HEALTH_IMPORT_SECRET = a long random string (also put it in the Shortcut)
//   HEALTH_USER_ID       = your Supabase auth user id (Authentication → Users → your row → id)
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Request body (POST, application/json):
// {
//   "secret": "….",
//   "readings": [
//     { "metric": "weight",  "date": "2026-06-17", "t": 1718600000000, "v": 78.8 },
//     { "metric": "hrv",     "date": "2026-06-17", "t": 1718600000000, "v": 55 },
//     { "metric": "vo2max",  "date": "2026-06-17", "t": 1718600000000, "v": 49.1 },
//     { "metric": "bp",      "date": "2026-06-17", "t": 1718500000000, "sys": 121, "dia": 68 }
//   ]
// }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IMPORT_SECRET = Deno.env.get('HEALTH_IMPORT_SECRET') || '';
const TARGET_USER_ID = Deno.env.get('HEALTH_USER_ID') || '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ALLOWED = new Set(['weight', 'hrv', 'vo2max', 'bp']);
const round = (n: unknown, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round((Number(n) || 0) * f) / f;
};
const decimalsFor = (m: string) => (m === 'hrv' ? 0 : m === 'vo2max' ? 1 : m === 'weight' ? 1 : 2);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

  if (!IMPORT_SECRET || body.secret !== IMPORT_SECRET) return json({ error: 'unauthorized' }, 401);
  if (!TARGET_USER_ID) return json({ error: 'HEALTH_USER_ID not configured' }, 500);

  const readings = Array.isArray(body.readings) ? body.readings : [];
  if (!readings.length) return json({ inserted: 0, skipped: 0, message: 'no readings' });

  // Group by day so each day's blob is read/merged/written once.
  const byDate: Record<string, any[]> = {};
  for (const r of readings) {
    if (!r || !ALLOWED.has(r.metric) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) continue;
    (byDate[r.date] ||= []).push(r);
  }

  let inserted = 0, skipped = 0;
  for (const date of Object.keys(byDate)) {
    const key = 'ht_' + date;
    const { data: rows } = await admin
      .from('tracker_data').select('value')
      .eq('user_id', TARGET_USER_ID).eq('key', key).limit(1);

    let day: Record<string, any> = {};
    if (rows && rows[0] && rows[0].value) { try { day = JSON.parse(rows[0].value); } catch {} }

    for (const r of byDate[date]) {
      const metric = r.metric;
      const t = Number(r.t) || Date.parse(date + 'T12:00:00');
      const arr: any[] = Array.isArray(day[metric]) ? day[metric] : (day[metric] = []);
      // Dedup: skip if a reading within 1s already exists for this metric.
      if (arr.some((e) => Math.abs((e.t || 0) - t) < 1000)) { skipped++; continue; }
      const entry = metric === 'bp'
        ? { id: 'hk' + t, t, sys: round(r.sys, 0), dia: round(r.dia, 0) }
        : { id: 'hk' + t, t, v: round(r.v, decimalsFor(metric)) };
      arr.push(entry);
      arr.sort((a, b) => (a.t || 0) - (b.t || 0)); // chronological → card's "latest" stays correct
      inserted++;
    }

    await admin.from('tracker_data').upsert(
      { user_id: TARGET_USER_ID, key, value: JSON.stringify(day), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );
  }

  return json({ inserted, skipped });
});
