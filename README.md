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
- Stored in the browser via `localStorage` (per-browser, per-device — not synced).
- Use **Export CSV** (bottom of the page) to back up your data.

## Hosting (GitHub Pages)
This repo is configured to serve `index.html` from the repository root. Enable
GitHub Pages in **Settings → Pages → Build and deployment → Source: Deploy from a
branch → `main` / `root`**.
