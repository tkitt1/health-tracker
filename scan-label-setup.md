# Scan Nutrition Label

Photograph a Nutrition Facts label and the app auto-fills **Calories, Protein, Carbs,
Fat, Fiber, Sugar, Sodium** into a review box you can edit before logging.

Two readers:
- **On-device OCR (default, free):** runs entirely in your browser (Tesseract.js).
  No key, no cost, fully private. Great on crisp, flat labels; less reliable on
  angled/glossy packaging.
- **Claude vision (optional fallback):** the **🤖 Re-read with Claude** button in the
  review box sends the same photo to a Supabase Edge Function that uses Claude's
  vision API. Best accuracy on real-world photos. ~1–2¢ per use; needs setup below.

## Using it (no setup needed for the free reader)
1. In the **Intake** section tap **📷 Scan label**, take/choose a photo of the label.
2. First time, the OCR engine downloads (~a few MB) — after that it's instant.
3. Review the per-serving values, **edit anything**, set **servings eaten**, tap **Add to tracker**.
4. If the free read looks off, tap **🤖 Re-read with Claude** (requires the setup below + sign-in).

Tips: fill the frame with the label, avoid glare, keep it roughly straight.

## Optional: enable the Claude fallback
The Claude reader runs server-side so your API key stays private, and it requires your
login so only you can spend the credits.

1. **Anthropic key** — console.anthropic.com → Settings → API keys → create a key
   (`sk-ant-…`); add a little credit under Billing if needed.
2. **Deploy the Edge Function** — Supabase Dashboard → Edge Functions → Create a
   function named `nutrition-label` → paste `supabase/functions/nutrition-label/index.ts` → Deploy.
3. **Secrets** (Edge Functions → Manage secrets):
   - `ANTHROPIC_API_KEY` = your `sk-ant-…` key
   - `HEALTH_USER_ID` = your Supabase auth user id (Authentication → Users → your row → **id**)
   *(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)*
4. Function URL (already wired into the app):
   `https://ztxrnqmpbgkzqjzehgke.supabase.co/functions/v1/nutrition-label`

Until this is set up, the **Re-read with Claude** button will report that the function
isn't available — the free on-device reader works regardless.

## Notes
- Values are **per serving**; the "servings eaten" multiplier scales them on add.
- Anything not detected comes back blank — leave it or type it in.
- New columns in CSV / Google Sheets: `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg`.
