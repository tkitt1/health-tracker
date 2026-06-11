# Apple Health → Tracker (Option A: Shortcut → Supabase Edge Function)

Pulls **Weight (kg), HRV (ms), VO₂ Max (ml/kg/min), Blood Pressure (mmHg)** from Apple Health
each morning and merges them into the tracker's per-day data. Latest reading per day,
going forward, merged server-side (never overwrites other data), deduped by timestamp.

## 1. Deploy the Edge Function
1. Supabase Dashboard → **Edge Functions** → **Create a function** → name it `health-import`.
2. Paste the contents of `supabase/functions/health-import/index.ts` → **Deploy**.
3. Edge Functions → **Manage secrets** → add:
   - `HEALTH_IMPORT_SECRET` = a long random string (keep it; goes in the Shortcut too)
   - `HEALTH_USER_ID` = your auth user id (Authentication → Users → your row → **id**)
   *(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)*
4. Your function URL is: `https://ztxrnqmpbgkzqjzehgke.supabase.co/functions/v1/health-import`

## 2. Build the iOS Shortcut ("Sync Health to Tracker")
For each metric, get the **latest sample today**, then POST them all. Steps:

1. **Get current date** → Format Date → `yyyy-MM-dd` (local). Save as `Date`.
2. For each of Weight / HRV (SDNN) / VO₂ Max / BP Systolic / BP Diastolic:
   - **Find Health Samples** → type = the metric, Sort by **End Date (Latest first)**, **Limit 1**.
   - If there is a result, read its **Value** and its **End Date** (→ Unix time, ms).
3. Build a **Dictionary** for each reading, e.g.:
   - weight: `{ "metric":"weight", "date":Date, "t":WeightTimeMs, "v":WeightValue }`
   - hrv:    `{ "metric":"hrv", … "v":HrvValue }`
   - vo2max: `{ "metric":"vo2max", … "v":Vo2Value }`
   - bp:     `{ "metric":"bp", … "sys":SysValue, "dia":DiaValue }` (use the systolic sample's time)
4. Add the dictionaries into a **List**, then wrap into the body:
   `{ "secret":"<HEALTH_IMPORT_SECRET>", "readings": <List> }`
5. **Get Contents of URL**:
   - URL = the function URL above
   - Method = **POST**, Request Body = **JSON** = the body dictionary
   - Header: `Authorization: Bearer <your anon public key>` *(Edge Functions require this header)*
6. (Optional) Show the response `{ inserted, skipped }` to confirm.

## 3. Automate it
Shortcuts app → **Automation** → Create Personal Automation → **Time of Day** (e.g. 7:00 AM) →
Run the "Sync Health to Tracker" shortcut → turn **Run Immediately / no confirmation** on.

## Notes
- Re-running is safe — duplicates (same metric + timestamp) are skipped.
- Each reading lands on the day it was measured and shows as the card's "latest as of <time>".
- The app picks it up on next open / focus (cloud sync).
