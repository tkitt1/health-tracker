# Scan Nutrition Label — setup

Photograph a Nutrition Facts label and the app auto-fills **Calories, Protein, Carbs,
Fat, Fiber, Sugar, Sodium**. The photo is read by Claude's vision API inside a Supabase
Edge Function — your Anthropic key stays server-side, and scanning requires your login so
only you can spend the credits. Cost is roughly **1–2¢ per scan**.

## 1. Get an Anthropic API key
1. Go to **console.anthropic.com** → sign in → **Settings → API keys → Create key**.
2. Copy the key (`sk-ant-...`). Add a little credit under **Billing** if your account has none.

## 2. Deploy the Edge Function
1. Supabase Dashboard → **Edge Functions** → **Create a function** → name it `nutrition-label`.
2. Paste the contents of `supabase/functions/nutrition-label/index.ts` → **Deploy**.
3. Edge Functions → **Manage secrets** → add:
   - `ANTHROPIC_API_KEY` = your `sk-ant-...` key
   - `HEALTH_USER_ID` = your Supabase auth user id (Authentication → Users → your row → **id**)
   *(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)*
4. Function URL (already wired into the app):
   `https://ztxrnqmpbgkzqjzehgke.supabase.co/functions/v1/nutrition-label`

## 3. Use it
1. Open the app and **sign in to sync** (required — scanning is tied to your account).
2. In the **Intake** section tap **📷 Scan label**, take/choose a clear photo of the label.
3. A review box shows the per-serving values — **edit anything**, set **servings eaten**, tap **Add to tracker**.
4. Each value is logged as a normal timestamped entry and syncs across your devices.

## Notes
- Best results: fill the frame with the label, avoid glare, keep it roughly straight.
- The model returns values **per serving**; the "servings eaten" multiplier scales them.
- Anything the label doesn't show comes back blank — just leave it or type it in.
- New columns in CSV / Google Sheets: `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg`.
