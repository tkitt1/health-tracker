// Supabase Edge Function: nutrition-label
// Receives a photo of a Nutrition Facts label (base64) from the logged-in app,
// asks Claude vision to read it, and returns structured per-serving macros.
//
// SECURITY: requires the caller's Supabase login (verifies the JWT and that the
// user is the configured owner) so only you can spend the API credits. The
// Anthropic key lives here as a secret and never reaches the browser.
//
// Deploy: Supabase Dashboard → Edge Functions → Create function "nutrition-label" → paste this.
// Secrets to set (Edge Functions → Manage secrets):
//   ANTHROPIC_API_KEY = your Anthropic API key (sk-ant-...)
//   HEALTH_USER_ID    = your Supabase auth user id (Authentication → Users → your row → id)
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Request body (POST, application/json):  { "image": "<base64 jpeg>", "media_type": "image/jpeg" }
// Response: { serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const TARGET_USER_ID = Deno.env.get('HEALTH_USER_ID') || '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

// Structured-output schema: numbers (or null when not visible on the label).
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    serving_size: { type: ['string', 'null'] },
    calories: { type: ['number', 'null'] },
    protein_g: { type: ['number', 'null'] },
    carbs_g: { type: ['number', 'null'] },
    fat_g: { type: ['number', 'null'] },
    fiber_g: { type: ['number', 'null'] },
    sugar_g: { type: ['number', 'null'] },
    sodium_mg: { type: ['number', 'null'] },
  },
  required: ['serving_size', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'],
};

const PROMPT =
  'This image is a Nutrition Facts label. Read it and return the values PER SERVING ' +
  '(not per container). Use numbers only with no units: calories in kcal; protein, ' +
  'total carbohydrate, total fat, dietary fiber, and total sugars in grams; sodium in ' +
  'milligrams. Put the serving size text (e.g. "2/3 cup (55g)") in serving_size. If a ' +
  'value is not visible or not on the label, return null for it. Do not guess.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  // Verify the caller is the configured owner (gates API spend to you).
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  if (TARGET_USER_ID && userData.user.id !== TARGET_USER_ID) return json({ error: 'forbidden' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const image = typeof body.image === 'string' ? body.image.replace(/^data:[^,]+,/, '') : '';
  const mediaType = body.media_type || 'image/jpeg';
  if (!image) return json({ error: 'no image' }, 400);

  let aiResp: Response;
  try {
    aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: PROMPT },
          ],
        }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    });
  } catch (e) {
    return json({ error: 'vision request failed: ' + (e as Error).message }, 502);
  }

  const ai = await aiResp.json().catch(() => null);
  if (!aiResp.ok) {
    return json({ error: ai?.error?.message || ('vision error ' + aiResp.status) }, 502);
  }

  const textBlock = Array.isArray(ai?.content) ? ai.content.find((b: any) => b.type === 'text') : null;
  if (!textBlock?.text) return json({ error: 'no label data found' }, 422);

  let parsed: any;
  try { parsed = JSON.parse(textBlock.text); } catch { return json({ error: 'could not parse label' }, 422); }

  return json(parsed);
});
