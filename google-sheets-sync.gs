/**
 * Daily Performance Tracker → Google Sheets nightly rollup.
 *
 * Runs on a daily time trigger (~11pm). Reads the day's data from Supabase,
 * totals every metric, and appends (or updates) one row in your sheet.
 *
 * SETUP
 * 1. Open your Google Sheet → Extensions → Apps Script.
 * 2. Paste this whole file in, replacing the default Code.gs contents.
 * 3. Fill in SUPABASE_SECRET_KEY below (Supabase → Project Settings → API →
 *    Secret keys → reveal the "default" sb_secret_... key). This key stays
 *    private inside Apps Script and bypasses Row-Level Security so the script
 *    can read your rows. NEVER put this key in the browser app.
 * 4. Set SHEET_NAME to the tab you want rows appended to.
 * 5. File → Project Settings → set the Time zone to YOUR local timezone
 *    (so "today" and the 11pm window are correct).
 * 6. Save. Run appendDailyTotals once manually to authorize + test.
 * 7. Triggers (clock icon) → Add Trigger:
 *      function: appendDailyTotals
 *      event source: Time-driven
 *      type: Day timer
 *      time of day: 11pm to Midnight
 */

// ===== CONFIG =====
const SUPABASE_URL = 'https://ztxrnqmpbgkzqjzehgke.supabase.co';
const SUPABASE_SECRET_KEY = 'PASTE_YOUR_sb_secret_KEY_HERE';
const SHEET_NAME = 'Daily Tracker';
// ==================

const HEADERS = [
  'date', 'pushups', 'squats', 'pullups', 'dips',
  'bike_min', 'bike_km', 'run_min', 'run_km', 'walk_min', 'walk_km', 'swim_min', 'swim_m',
  'coffee', 'creatine', 'protein', 'work_periods', 'work_minutes', 'meditation_min', 'reading_min'
];

function appendDailyTotals() {
  const tz = Session.getScriptTimeZone();
  const dateKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const day = fetchDay_(dateKey);
  writeRow_(dateKey, day);
}

function fetchDay_(dateKey) {
  const url = SUPABASE_URL + '/rest/v1/tracker_data?key=eq.ht_' + dateKey + '&select=value';
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + SUPABASE_SECRET_KEY },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Supabase fetch failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
  const rows = JSON.parse(res.getContentText() || '[]');
  return rows.length ? JSON.parse(rows[0].value || '{}') : {};
}

// Sum an entry array (each {v} or cardio {time,dist}); tolerate legacy numbers.
function sum_(v, field) {
  if (Array.isArray(v)) {
    const t = v.reduce(function (s, e) { return s + (Number(field ? e[field] : e.v) || 0); }, 0);
    return Math.round(t * 100) / 100;
  }
  return Number(v) || 0;
}

function writeRow_(dateKey, d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.getRange('A:A').setNumberFormat('@'); // keep dates as text so matching works
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);

  const vals = [
    dateKey,
    sum_(d.pushups), sum_(d.squats), sum_(d.pullups), sum_(d.dips),
    sum_(d.bike, 'time'), sum_(d.bike, 'dist'),
    sum_(d.run, 'time'), sum_(d.run, 'dist'),
    sum_(d.walk, 'time'), sum_(d.walk, 'dist'),
    sum_(d.swim, 'time'), sum_(d.swim, 'dist'),
    sum_(d.coffee), sum_(d.creatine), sum_(d.protein),
    Number(d.timer_periods) || 0,
    Math.floor((Number(d.timer_total_work) || 0) / 60),
    sum_(d.meditation), sum_(d.reading)
  ];

  // Update today's row if it already exists, otherwise append.
  const lastRow = sh.getLastRow();
  const dates = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues().map(function (r) { return r[0]; }) : [];
  const idx = dates.indexOf(dateKey);
  if (idx >= 0) {
    sh.getRange(idx + 2, 1, 1, vals.length).setValues([vals]);
  } else {
    sh.appendRow(vals);
  }
}
