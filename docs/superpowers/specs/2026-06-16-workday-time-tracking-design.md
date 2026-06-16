# Work-day time tracking: editable start/end, past-day view, 8pm auto-end, travel time zone

**Date:** 2026-06-16
**Status:** Approved (design); pending implementation plan
**Scope:** `index.html` (single-file app), plus Node logic tests under `test/`

## Problem

The work-day timer (`ht_timer`) is a single global Pomodoro tracker that always
reflects the *real current day* and ticks live. Three gaps:

1. There's no way to manually correct the work-day **start time** (or end time).
2. Navigating to a **past date** still shows the live, running timer — there's no
   way to scroll back and see a calm, finished summary of that day.
3. There's no automatic end to the work day — it runs until the user clicks End Day.

Plus a related ask: when the user travels, the app should follow the local time
zone (it largely already does) and **note where they are**.

## Decisions (from brainstorming)

- **End stamp at 8pm:** record exactly 8:00pm local; must remain editable afterward.
- **Bypass UX:** prompt only at 8pm; "keep working" sets a per-day bypass so it
  won't ask again that day.
- **Edit scope:** start/end edits apply to the **day being viewed** (so past days
  are fixable).
- **Cutoff:** fixed 8pm constant (`WORK_AUTO_END_HOUR = 20`).
- **Location:** record **time zone / city name** only — zero permission, never
  leaves the device. No GPS, no geocoding.
- **Travel capture:** automatic, on **time-zone change**.
- **Old timestamps after travel:** keep displaying in the device's **current**
  zone (no change to timestamp storage).
- **8pm prompt mechanism:** native `confirm()` (matches existing End-Day dialog).
- **Editable start sync caveat:** accepted (see Risks).

## Existing building blocks (reuse, don't reinvent)

- `getField/saveField` read/write the **viewed** day's record (`ht_<viewed>`).
- `getTodayField/setTodayField` read/write the **real today** record.
- `toLocalInput(ms)` + the IF tracker's `toggleStartEdit` / `ifSetStart` pattern
  (datetime-local reveal → parse → write → re-render).
- `updateTimerLive(silent)` is the per-second tick; it reconciles then calls
  `refreshTimerUI(t)`.
- `refreshTimerUI(t)` renders the timer card; `endWorkDay()` stamps
  `work_ended_at`, mirrors stats (`mirrorDailyStats`), and stops the timer.
- `mirrorDailyStats(t)` writes `timer_periods` / `timer_total_work` onto the day.
- `isToday()` compares the viewed date to the real today.
- `metaGet()/metaSet()` for the global `ht_meta` blob.

## Feature A — Editable work start AND end (viewed day)

**Behavior:** In the timer card, add an "edit" link to both the **Started** and
**Ended** stats. Clicking reveals a `datetime-local` input prefilled with the
current value (defaulting to the viewed day's date if unset). On change, write
`work_started_at` / `work_ended_at` (epoch ms) to the **viewed day's** record via
`saveField`, then re-render the timer card.

**Display change:** the Started/Ended stats currently read `getTodayField`
(real today). Switch them to read the **viewed day's** record so they reflect the
shown date. For today this reads the same record the live timer writes, so live
behavior is unchanged.

**Validation:** ignore empty/`NaN` input (mirror `ifSetStart`). No ordering
enforcement between start and end in v1 (keep it forgiving; the user is correcting
their own data).

## Feature B — Past days show no running clock

Make the timer card date-aware in `refreshTimerUI`:

- **Today (`isToday()` true):** unchanged live behavior — countdown, progress bar,
  Start/Pause/Skip/Reset/End controls, live periods/total.
- **Past day:** static, view-only:
  - Hide the live countdown number, progress bar, and all control buttons.
  - Phase line shows `✓ Work day ended at 6:42pm` when `work_ended_at` is set,
    else `No work day recorded`.
  - Stats show **that day's stored** values: Started, Ended (both still editable
    per A), Work periods (`timer_periods`), Total work (`timer_total_work`).
  - Hide the live-only "Until Long Break" stat on past days.

The global timer keeps ticking for the real current day in the background; only the
**display** freezes when a past date is viewed. `updateTimerLive` still runs and
updates state for real-today, but `refreshTimerUI` renders the static card when the
viewed date isn't today.

## Feature C — Auto-end at 8pm with bypass prompt

- Add `const WORK_AUTO_END_HOUR = 20;`.
- Helper `eightPmMs(date)` → epoch ms of 8:00pm local for that day.
- In `updateTimerLive`, after reconcile, gate a **one-time prompt** when ALL hold:
  - viewing/realtime is the real current day context (check against real today),
  - work was started today (`work_started_at` set),
  - day not ended (`work_ended_at` is 0/unset),
  - not bypassed (`work_overtime_bypass !== true` on today's record),
  - `Date.now() >= eightPmMs(today)`.
- Guard with a module-level `eightPmPromptOpen` flag so the per-second tick can't
  re-enter while `confirm()` is open.
- Prompt: `confirm("It's 8pm — end your work day? (Cancel = keep working / overtime)")`
  - **OK →** `autoEndWorkDayAt8pm()`: stamp `work_ended_at = eightPmMs(today)`,
    run the same bookkeeping as `endWorkDay` (mirror stats, reset live counters,
    stop timer) but **no confirm** and an **8pm** stamp instead of `Date.now()`.
  - **Cancel →** set `work_overtime_bypass = true` on today's record; timer
    continues; no further prompt that day.
- **App-closed case:** if closed at 8pm and reopened later, the gate fires on the
  next tick after reopen; the stamp is still 8:00pm sharp.
- **Reset:** `work_overtime_bypass` lives on the per-day record, so each new day
  starts fresh automatically.
- The auto-stamped end remains editable via Feature A.

`endWorkDay()` and `autoEndWorkDayAt8pm()` should share a small internal helper for
the common bookkeeping to avoid divergence.

## Feature D — Auto-note time zone on change (private, zero-permission)

- On app open each day, read `Intl.DateTimeFormat().resolvedOptions().timeZone`
  (e.g. `"Europe/London"`).
- Keep `last_tz` in `ht_meta`. The first time a day is opened, stamp that day's
  record with `tz`. When the current zone **differs** from `last_tz` (travel),
  record the new zone on today's record, update `ht_meta.last_tz`, and show a brief
  note (e.g. `📍 Time zone changed to London`).
- Display a small `📍 <City>` chip near the date header, reflecting the **viewed
  day's** recorded `tz` (fall back to the current device zone if a day has none).
  City = `tz.split('/').pop().replace(/_/g, ' ')` (handles
  `America/Argentina/Buenos_Aires` → `Buenos Aires`).
- **No change** to timestamp storage or rendering — times stay in the device's
  current zone, as decided. The 8pm cutoff and "today" already follow local time.

## Data model additions (all on the per-day `ht_<date>` record unless noted)

| Field | Type | Meaning |
|---|---|---|
| `work_started_at` | epoch ms | already exists; now user-editable |
| `work_ended_at` | epoch ms | already exists; now user-editable + 8pm auto-stamp |
| `work_overtime_bypass` | boolean | set when user chooses "keep working" at 8pm |
| `tz` | string (IANA) | the time zone recorded for that day |
| `ht_meta.last_tz` | string (IANA) | last seen device zone, for change detection (global) |

## Testing

New `test/workday-time.test.mjs` (pure Node, mirrors index.html logic, matching the
existing `test/*.test.mjs` style):

- `eightPmMs(date)` returns 20:00:00.000 local for the given day.
- `shouldPrompt8pm({now, startMs, ended, bypassed})` — true only when started,
  not ended, not bypassed, and `now >= 8pm`; false otherwise (table of cases incl.
  before 8pm, already ended, already bypassed, never started).
- `timerCardMode(isToday)` → `'live'` | `'static'`.
- `tzCity(tz)` → city string for representative zones incl. a 3-segment zone.
- `tzChanged(prev, cur)` → true only on a real change (and false when `prev` unset).

Plus manual browser verification in the preview:
- Edit links reveal a datetime input and the stat updates on change (today + a past
  day).
- Navigating to a past date shows the static card (no countdown, no controls).
- Simulated 8pm (stub `eightPmMs`/clock) shows the prompt; OK stamps 8pm, Cancel
  sets bypass and suppresses re-prompt.
- A simulated tz change surfaces the `📍` note/chip.

## Risks / caveats

- **Editable start vs sync (accepted):** sync treats `work_started_at` as
  "earliest-wins" across devices (commit `b48bdcd`). A manual edit to an *earlier*
  start always sticks; editing to a *later* start could be overridden by an
  un-synced earlier auto-stamp on another device. Single-device use is unaffected.
  If it ever bites, add a "manually set" override flag. `work_ended_at` uses
  newest-wins and has no such constraint.
- **`confirm()` while backgrounded:** the 8pm prompt can only appear when the page
  has focus; on reopen it fires on the next tick. Acceptable.
- **Past-day editing of `tz`/stats:** v1 only makes Started/Ended editable on past
  days; periods/total/tz are display-only there.

## Out of scope (YAGNI)

- GPS coordinates / reverse geocoding.
- Per-entry time-zone freezing of historical timestamps.
- User-configurable cutoff time.
- Multi-device "manual override" flag for the start time (revisit only if needed).
