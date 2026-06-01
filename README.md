# Daily Health Tracker

A simple, self-contained daily habit & health tracker. Single `index.html` file — no build step, no dependencies, no server required. All data is stored locally in your browser (`localStorage`).

## Tracks
- **Exercise:** pushups, pull ups, dips, squats
- **Cardio:** bike, run, walk (km), swim (m) — time + distance
- **Work timer:** 30-min work / 4-min break, with a 15-min long break every 4th period (sound alerts + pause)
- **Intake:** coffee (with last-coffee time), creatine, protein (with "what you ate")
- **Intermittent fasting:** Start Now button, 16/18/20/24h goals + manual days, live elapsed timer
- **Mind:** meditation, reading minutes
- **Workout ideas:** random workout suggestions + daily notes
- **History:** 30-day table, per-day navigation, CSV export

## Usage
Open `index.html` in any modern browser, or visit the hosted URL.

## Data
- Stored in the browser via `localStorage`, and optionally synced to Supabase.
- Use **Export CSV** (bottom of the page) to back up your data.

## Cloud sync (Supabase, optional)
The app is offline-first: it works fully on `localStorage` and mirrors every change
to Supabase when signed in. Sign-in is passwordless (magic link).

Setup:
1. **SQL Editor** — create the table + RLS:
   ```sql
   create table public.tracker_data (
     user_id uuid not null references auth.users on delete cascade,
     key text not null,
     value text,
     updated_at timestamptz not null default now(),
     primary key (user_id, key)
   );
   alter table public.tracker_data enable row level security;
   create policy "own rows" on public.tracker_data
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
2. **Authentication → Providers → Email**: enabled (magic link works out of the box).
3. **Authentication → URL Configuration → Redirect URLs**: add the URLs you open the
   app from, e.g. `http://localhost:8080` and `https://YOUR-USERNAME.github.io/health-tracker/`.
4. **Project Settings → API**: copy the Project URL and the `anon public` key into the
   top of `index.html` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

Sync model: each `localStorage` key is one `(user_id, key)` row; newest write wins per key.

## Hosting (GitHub Pages)
This repo is configured to serve `index.html` from the repository root. Enable
GitHub Pages in **Settings → Pages → Build and deployment → Source: Deploy from a
branch → `main` / `root`**.
