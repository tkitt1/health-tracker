---
name: My Performance Tracker
description: A calm, dark-first daily health and performance instrument in a single HTML file.
colors:
  bg: "#0f1117"
  surface: "#1a1d27"
  surface-hover: "#222632"
  border: "#2a2e3a"
  text: "#e4e4e7"
  text-muted: "#71717a"
  accent: "#6366f1"
  green: "#22c55e"
  orange: "#f59e0b"
  red: "#ef4444"
  blue: "#3b82f6"
  bg-light: "#f4f5f7"
  surface-light: "#ffffff"
  text-light: "#1a1d27"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "18px"
  round: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  scan-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
---

# Design System: My Performance Tracker

## 1. Overview

**Creative North Star: "The Quiet Instrument"**

This is the interface of a daily tool, not a dashboard you show off. It reports
the state of the day plainly and gets out of the way. The surface is a deep,
near-black blue-gray; information sits on slightly lifted panels; a single indigo
accent marks what's interactive or current, and a small set of semantic colors
(green / orange / red / blue) carry meaning across the different trackers. Nothing
shouts. Consistency is rewarded through calm, honest feedback rather than
celebration.

Density is deliberate: type runs small (0.8–0.95rem for most controls), spacing is
tight but rhythmic, and many sections collapse so a returning user sees only what
they're logging right now. The system is **flat by conviction** — there is
essentially no drop shadow anywhere. Depth comes from tonal layering (background →
surface → surface-hover) and from low-alpha accent "glows" (a tinted background
plus a same-hue border) on active or selected elements.

What it explicitly rejects: generic SaaS-dashboard slop. No Inter-for-everything,
no purple-to-blue gradients, no hero-metric template (big number / small label /
gradient accent), no endless identical icon-card grids, no decorative
glassmorphism. The restraint is the brand.

**Key Characteristics:**
- Dark-first, with a fully realized light theme (`body.light`).
- One indigo accent + four semantic status hues, used by role, never decoratively.
- Flat surfaces; depth via tonal layers and accent-glow tints, not shadows.
- Native system font stack — fast, familiar, zero web-font cost.
- Compact, collapsible, mobile-first; built for fast one-handed daily entry.

## 2. Colors

A restrained dark palette: cool near-black neutrals, one indigo voice, and four
semantic status hues that only appear where they carry meaning.

### Primary
- **Indigo Signal** (`#6366f1`): The single interactive/identity accent. Marks the
  current date, focused inputs, active tabs, and primary actions. Appears as solid
  fill on primary buttons and as a low-alpha "glow" (≈12–15% alpha background +
  same-hue border) on selected/active states. Identical value in both themes.

### Secondary (semantic status hues)
- **Success Green** (`#22c55e` dark / `#16a34a` light): Completed goals, positive
  streaks, routine hints, the "Tracker" wordmark.
- **Focus Orange** (`#f59e0b` dark / `#d97706` light): In-progress / attention
  states (e.g. active fasting or timer warnings).
- **Alert Red** (`#ef4444` dark / `#dc2626` light): Stop / over-limit / destructive.
- **Info Blue** (`#3b82f6` dark / `#2563eb` light): Neutral informational accents.

### Neutral
- **Void** (`#0f1117` dark / `#f4f5f7` light): Page background and input fields.
- **Surface** (`#1a1d27` dark / `#ffffff` light): Cards, panels, controls at rest.
- **Surface Hover** (`#222632` dark / `#eceef1` light): Hovered controls.
- **Hairline** (`#2a2e3a` dark / `#d8dbe0` light): 1px borders and dividers.
- **Ink** (`#e4e4e7` dark / `#1a1d27` light): Primary text.
- **Muted Ink** (`#71717a` dark / `#6b7280` light): Labels, secondary text, units.

### Named Rules
**The Meaning-Only Color Rule.** The four status hues (green/orange/red/blue) are
reserved for state and meaning. Never use them decoratively or to "add interest" —
if a color appears, it should tell the user something.

**The Glow-Not-Shadow Rule.** Emphasis is a low-alpha tint of the accent's own hue
(background + matching border), never a drop shadow. Depth is tonal, not lifted.

## 3. Typography

**Display / Body / Label Font:** the native system stack
(`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`).

**Character:** One family, differentiated by weight and size — no font pairing.
This is intentional: the system font renders instantly, feels native on every
device, and keeps the single-file app dependency-free. Personality comes from
tight tracking on headings and disciplined hierarchy, not from typeface choice.

### Hierarchy
- **Display** (700, `1.6rem`, `-0.02em`): The app title / header. The only place
  with negative tracking.
- **Metric** (700, `1.5rem`): Large numeric readouts — counts, totals, timer
  values. The data is the hero, presented plainly.
- **Body** (400, `~0.9rem`, line-height `1.5`): Input values, notes, table cells.
- **Label** (600, `0.8rem`, `0.08em`, UPPERCASE): Section titles. Compact tracked
  caps used as functional structural labels for scannability — not as decorative
  eyebrows above marketing sections.

### Named Rules
**The One-Family Rule.** One system font, varied by weight and size. Never
introduce a second typeface or a web font; the speed and native feel are the point.

## 4. Elevation

This system is **flat by default**. There is effectively no `box-shadow` anywhere
in the app. Depth is communicated two ways: (1) **tonal layering** — the cool
neutral ramp steps background → surface → surface-hover so panels read as slightly
forward without a shadow; and (2) **accent-glow** — active/selected elements get a
low-alpha tinted background plus a same-hue 1px border, which reads as "lit" rather
than "raised."

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If something needs to feel
forward, step it up the tonal ramp or give it an accent-glow — do not reach for a
drop shadow.

## 5. Components

### Buttons
- **Shape:** Gently rounded (`8px`); circular (`50%` / `999px`) for icon-only
  controls like the theme toggle and date-nav arrows; pill (`18px`) for the
  contextual "Today" jump button.
- **Accent (primary):** Solid indigo fill, light text, `10px 18px` padding. The
  committed primary action.
- **Ghost / icon:** `surface` background, `1px` hairline border, `text` color;
  hover lifts to `surface-hover`. Used for navigation and secondary controls.
- **Glow button (e.g. scan):** `accent-glow` background + `1px` accent border +
  accent text; hover inverts to solid accent fill with white text.
- **Hover / transitions:** Short and functional — `transition: ... 0.15s` on
  background, border-color, or transform. No bounce, no choreography.

### Cards / Containers
- **Corner Style:** `12px` (`--radius`) for primary panels; `8px` for nested
  controls.
- **Background:** `surface`, over the `bg` page.
- **Shadow Strategy:** None — see Elevation. Separation is the `1px` hairline
  border plus the tonal step.
- **Border:** `1px solid` hairline.
- **Internal Padding:** `16px` typical; tighter (`8–10px`) for dense control rows.

### Inputs / Fields
- **Style:** `bg`-colored field, `1px` hairline border, `8px` radius, `0.9rem` text.
- **Focus:** Border shifts to indigo accent (`transition: border-color 0.15s`). No
  glow ring — the border color change is the focus signal.
- **Placeholder / muted:** `text-muted`; watch contrast against tinted surfaces.

### Navigation
- **Date nav:** Centered round arrow buttons flanking an indigo `date-display`;
  a pill "Today" button appears only when viewing a past day.
- **Sections:** Collapsible. An uppercase tracked `section-title` with a rotating
  chevron; collapsed sections hide everything but their head and a muted summary
  line. On mobile (`≤640px`) the header stacks and centers.

### Signature: Accent-Glow State
The defining pattern. Active/selected/highlighted elements (selected goals, active
tabs, the scan button, routine hints) share one recipe: a ~12–15% alpha accent
background, a 1px border in the same hue, and accent-colored text. It's the app's
entire emphasis language.

## 6. Do's and Don'ts

### Do:
- **Do** keep one indigo accent for interactivity/identity and reserve
  green/orange/red/blue strictly for state and meaning (the Meaning-Only Color Rule).
- **Do** convey emphasis with accent-glow (tinted bg + same-hue border), and depth
  with the tonal ramp (bg → surface → surface-hover).
- **Do** keep surfaces flat — no drop shadows (the Flat-By-Default Rule).
- **Do** use the single system font family, varied only by weight and size.
- **Do** keep both dark and light themes at WCAG AA: body text ≥ 4.5:1; large/metric
  text ≥ 3:1. Bump muted gray toward ink if it's close on a tinted surface.
- **Do** keep tap targets comfortable (≥ 44px) and test heading/value copy at every
  breakpoint so nothing overflows.

### Don't:
- **Don't** drift toward generic SaaS-dashboard slop: no Inter or other web font,
  no purple-to-blue gradients, no hero-metric template, no identical icon-card grids.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism.
- **Don't** use a colored `border-left`/`border-right` stripe as an accent on cards
  or rows; use the full `1px` hairline border or an accent-glow instead.
- **Don't** introduce drop shadows to fake depth — step the tonal ramp instead.
- **Don't** use bounce or elastic easing; transitions stay short (`~0.15s`) and calm.
- **Don't** color anything just for decoration — if it's not interactive or
  meaningful, it's neutral.
- **Don't** ship motion without a `prefers-reduced-motion` alternative (current gap;
  add a reduced-motion fallback when motion is touched next).
