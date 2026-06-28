# Product

## Register

product

## Users

A single power user (the maker) logging daily habits, workouts, and focus time
every day, across phone and desktop. The context is fast, repeated daily entry
and at-a-glance review, often one-handed on mobile during or between activities.
Sign-in is optional (passwordless magic link); the app is offline-first and works
fully on `localStorage`, mirroring to Supabase when signed in.

## Product Purpose

A self-contained daily health and performance tracker in a single `index.html`
file — no build step, no dependencies. It tracks exercise (pushups, pull ups,
dips, squats), cardio (bike/run/walk/swim), a Pomodoro-style work timer,
intake (coffee/creatine/protein), intermittent fasting, mind (meditation,
reading), workout ideas, and a 30-day history with CSV export. Success is
frictionless daily logging and a clear, honest picture of the day and recent
trend — the maker actually using it every day without it getting in the way.

## Brand Personality

Focused, calm, precise. A serious daily instrument, not a toy. The interface is
quiet and gets out of the way: it reports state plainly, rewards consistency
without fanfare, and trusts the user to read the numbers. Three words:
**calm, precise, dependable.** Emotional goal: the steady confidence of a
well-made tool you reach for without thinking.

## Anti-references

Generic SaaS dashboard slop. Specifically avoid: Inter-for-everything,
purple-to-blue gradients, the hero-metric template (big number / small label /
gradient accent), endless identical icon-card grids, and tracked-uppercase
eyebrows above every section. The current restrained dark/indigo system is the
right lane; do not drift it toward the AI-default dashboard look.

## Design Principles

- **Instrument, not dashboard.** Every screen serves daily entry and quick
  review. If an element doesn't speed logging or sharpen the read of state, cut it.
- **Quiet by default, legible always.** Restraint in color and motion; clarity is
  non-negotiable. State is readable at a glance, on a phone, in any light.
- **Consistency over celebration.** Reward streaks and progress through honest,
  calm feedback — never confetti, badges, or nagging.
- **Offline-first, no-friction.** It must work instantly with zero setup and zero
  dependencies. Sync is a bonus, never a gate.
- **Single-file discipline.** New work stays within the self-contained `index.html`
  constraint unless there's a deliberate reason to break it.

## Accessibility & Inclusion

Target WCAG AA. Body text ≥ 4.5:1 contrast against its background (watch muted
gray on tinted surfaces in both themes); large text ≥ 3:1. Respect
`prefers-reduced-motion` with a non-animated alternative for every transition.
Comfortable touch targets (≥ 44px) for one-handed mobile use. Both dark and light
themes must independently meet these bars.
