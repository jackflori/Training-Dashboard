# Training Dashboard

A personal distance-running dashboard built around my own training: a sliding
weekly plan calendar, GPX file upload that rolls into weekly totals,
season-to-date totals, and a countdown to nationals.

Platform-agnostic by design — it reads GPX exports from Strava, Garmin Connect,
or anything else, with no API keys or OAuth to maintain.

Two companion docs: [`CLAUDE.md`](./CLAUDE.md) is the working spec — the settled
scope and constraints. [`DECISIONS.md`](./DECISIONS.md) is the decision log —
what was considered, what was chosen, and why, including the calls that were
later reversed.

## Stack

- **Next.js 14** (App Router) · React 18 · TypeScript (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS** with semantic color tokens + dark mode
- **fast-xml-parser** for GPX; distance/pace/elevation math is hand-rolled
- **Zod** for request validation
- **Persistence:** file-backed JSON store today (`src/lib/store`), Prisma +
  Postgres in Phase 2 (`prisma/schema.prisma` already models it)
- **Deploy target:** Vercel

## Getting started

```bash
npm install
cp .env.example .env   # optional — every value has a default
npm run dev            # http://localhost:3000
```

No credentials required. To log a run, export a GPX from Strava (activity page →
⋯ → Export GPX) or Garmin Connect (activity → gear icon → Export to GPX) and drop
it anywhere on the page.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (also runs lint + typecheck) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run prisma:generate` / `prisma:migrate` | Phase 2, unused for now |

## How it fits together

```
src/
  app/
    page.tsx                    Server component: loads dashboard + current week
    week/[start]/summary/       Weekly summary page (gated, see below)
    api/
      uploads                   POST -> parse a batch of GPX files; GET -> list
      uploads/[id]              PATCH -> flag workout + volume; DELETE -> discard
      week?start=YYYY-MM-DD     GET  -> plan, uploads, aggregate, reflection
      plan                      PUT  -> upsert one plan cell (off / miles / note)
      summary                   PUT  -> save the week's 1-5 ratings
      config                    GET/PUT -> season dates
      dashboard                 GET  -> config, season totals, week list
  components/                   Client UI (Dashboard orchestrator + pieces)
  lib/
    dates.ts                    Monday-start week math, summary unlock rule
    gpx/parse.ts                GPX -> distance / moving time / elevation gain
    store/                      Store interface + JsonStore (swap point for Prisma)
    domain/                     Pure logic: units/pace, weekly + season totals
    dashboard.ts                Assembles the read-model the UI consumes
    api.ts / client.ts          Error-handling wrappers for routes / browser fetch
```

### The two surfaces

**Main page — the plan, plus the season's shape.** The Mon–Sun calendar shows what
you *intend* to run: each day has AM and PM slots with an off toggle, a mileage
field, and a `+` that reveals a workout note. Both slots off marks a rest day. No
per-day uploaded data appears in the grid by design.

Below it, a **season mileage chart** (one column per week: actual as the column,
planned as a target marker on the same axis — click a column to jump the calendar
there) and a **week-over-week ramp flag** against the ~10% rule, with the last four
logged weeks.

**Weekly summary — the numbers.** Uploaded files roll into a weekly aggregate
(mileage, moving time, average pace, elevation gain, workout volume and its share
of the week) shown alongside three raw 1–5 ratings for eating, sleep, and school
stress. It unlocks **Sunday at 1:00 pm Eastern** — past weeks are always open,
future weeks never are. The gate is enforced server-side, not just in the UI.

### Uploading

The whole page is a drop target; files aren't matched to days or sessions. Each
file is parsed for distance, moving time, and elevation gain, then bucketed into
the week containing its own start timestamp. A batch drop opens one review screen
where you flag any workouts and enter their volume — a file that fails to parse
is reported there rather than failing the batch.

## Status

Core is built and verified end to end: GPX ingestion and review, plan calendar,
weekly summary with ratings, season mileage chart, week-over-week ramp flag,
season totals, countdown, settings. Persistence runs on Postgres in production
behind a single-password edit gate; reads are public.

The GPX math is checked against a synthetic file with known ground truth
(distance, moving-time exclusion of stops, elevation noise filtering) and the
summary unlock rule has boundary tests on both sides of the Nov 1 DST change.

Remaining work is listed in [`DECISIONS.md`](./DECISIONS.md) → "Open / deferred".

## Note on AI Usage

This project was built with heavy AI assistance — more than my
[Game Boy emulator](https://github.com/jackflori/GameBoy-Emulator), where AI was
used for explanations rather than code. Here, most of the implementation was
AI-generated. My contribution was the scope, the design decisions, and the
review: deciding what the app should do, judging what came back, and rejecting
or reversing it when it was wrong.

Some of the calls that shaped the result:

- **Moving time over elapsed**, and the thresholds that make it robust
- **Cutting the progress bar and the shoe tracker** — both would have added
  manual upkeep or implied a correspondence in the data that doesn't exist
- **Reversing the ramp metric to count an unlogged week as zero.** The original
  implementation skipped those weeks, with a reasonable-sounding argument behind
  it. It was wrong: a week off with an injury is the part of a season you most
  need to see, and skipping it quietly erased it. The fix also surfaced a bug
  that was hiding past weeks from the season chart entirely.

[`DECISIONS.md`](./DECISIONS.md) is the honest record of that process, reversals
included. The commit history is co-authored, so the split is visible there too.

## Reflections

### Hardest bugs
- **Two week-ranges disagreeing.** The calendar nav was built from "current week
  → season end" while the season chart used "season start → season end". Clicking
  a past column in the chart jumped the calendar to a week the nav didn't know
  existed, so `indexOf` returned -1 and both arrows disabled — a dead end you
  could only escape via "jump to this week". Fixed by deriving both from one
  range.
- **A dark-mode theme token used as a scrim.** Modal overlays were painted with
  the `ink` color at 50% opacity, which is near-black in light mode and *white*
  in dark mode. Every dialog would have flashed a white wash instead of dimming
  the page. Only caught by rendering the page in both themes rather than reading
  the markup.
- **Elevation noise.** Summing every positive altitude delta over a
  1-second-sampled run accumulates hundreds of phantom feet from GPS jitter. A
  synthetic file with a known 100 m climb and ±0.5 m noise made the size of the
  error obvious; a hysteresis filter fixed it.

### What I'd do differently
- **Check platform constraints before building against them.** The Strava
  integration was written before confirming that registering an app now requires
  a paid subscription — a five-minute question that invalidated ~800 lines.
- **Deploy earlier.** The file-backed store worked perfectly in local
  development and could never have worked on Vercel, whose filesystem is
  read-only. That's a whole class of bug that only appears at the platform
  boundary.
- **Keep test data away from real data.** Seeded fixtures and my own entries
  shared one store file, and clearing fixtures wiped real input more than once.
