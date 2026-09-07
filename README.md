# Training Dashboard

**[View it live →](https://training-dashboard-one-sigma.vercel.app/)**

A personal distance-running dashboard I built for my own cross-country training:
plan the week, drop in GPS files from a watch, and see the season's shape against
the plan. Viewing is open to anyone; editing is mine.

Platform-agnostic by design — it reads GPX exports from Strava, Garmin Connect,
or anything else, with no API keys or OAuth to maintain.

## What it does

**Plan the week.** A Mon–Sun calendar with AM and PM slots per day, each with
planned mileage, an off toggle, and an optional workout note. Both slots off
marks a rest day. The calendar shows the plan only — what actually happened
lives elsewhere, so the planning surface stays a planning surface.

**Log runs by dropping files.** The whole page is a drop target for GPX files.
Each one is parsed for distance, moving time, and elevation gain, then bucketed
into the week it belongs to. Files aren't matched to individual days or
sessions — they roll into a weekly total. A batch drop opens one review screen
to flag workouts and enter their volume.

**See the season.** A mileage chart across the whole season, with actual miles
as columns and planned mileage as a target marker on the same axis. Clicking a
week jumps the calendar there.

**Catch a ramp too fast.** Week-over-week mileage is checked against the ~10%
guideline that sports science associates with injury risk. A flagged jump can be
dismissed with a reason — injury return, illness, intentional build — and the
dismissal applies only to that week, so a later genuine spike still fires.

**Close out the week.** A summary page opens Sunday afternoon with the week's
mileage, moving time, average pace, elevation, and workout volume, alongside
three 1–5 ratings for eating, sleep, and school stress. The ratings are stored
raw and never combined into a score.

## How it's built

- **Next.js 14** (App Router) · React 18 · TypeScript (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS** with semantic color tokens and dark mode
- **PostgreSQL** via Prisma, hosted on Neon; deployed on Vercel
- **fast-xml-parser** for GPX; the distance, pace, and elevation math is hand-rolled
- **Zod** for request validation

```
src/
  app/
    page.tsx                    Server component: dashboard + current week
    week/[start]/summary/       Weekly summary page
    api/                        Route handlers (uploads, plan, summary,
                                ramp-ack, config, dashboard, auth)
  components/                   Client UI
  lib/
    gpx/parse.ts                GPX -> distance / moving time / elevation gain
    domain/                     Pure logic: units, weekly + season totals, ramp
    store/                      Store interface; JsonStore + PrismaStore
    dates.ts                    Monday-start week math, summary unlock rule
    auth.ts                     Signed session cookie; requireEdit() guard
```

Persistence sits behind a `Store` interface with two implementations, chosen at
runtime by whether `DATABASE_URL` is set. Nothing above `lib/store` knows which
is live — which is what made moving from a local JSON file to Postgres a
one-file change with no edits to routes, components, or domain logic.

Domain logic is pure: `lib/domain` takes arrays and returns numbers, with no
database, framework, or network involved. The calculations that are hardest to
get right don't depend on anything.

Two companion docs: [`CLAUDE.md`](./CLAUDE.md) is the working spec — settled
scope and constraints. [`DECISIONS.md`](./DECISIONS.md) is the decision log —
what was considered, what was chosen, and why, including the calls that were
later reversed.

## The parts that were actually hard

**Moving time, not elapsed.** Elapsed time is trivial and nearly useless — a
water stop or a watch left running inflates it and drags average pace with it.
Moving time only accrues on segments above 0.5 m/s (~32:00/mi, slower than any
real running), and sample gaps over 30 seconds are skipped entirely, since those
mean a paused watch or lost signal. Verified against a synthetic GPX with known
ground truth: a 20-minute run at 3.0 m/s with a 3-minute standing stop parses to
exactly 1200 s moving rather than the 1380 s elapsed.

**Elevation noise.** GPS and barometric altimeters jitter a metre or two while
standing still, so naively summing positive changes over an hour of one-second
samples invents hundreds of feet of climb. A hysteresis filter tracks the last
confirmed altitude and only banks a change once it clears 1.5 m — in testing,
180 s of ±0.5 m noise contributed 0.5 m instead of ~45 m.

**A week with no runs means time off, not missing data.** The ramp metric
originally skipped weeks with no files. That was wrong: for someone who logs
consistently, an empty week almost always means injury or illness, and that's
the part of a season you most need to see. Counting it as a real zero forced
three cases to be handled honestly — a drop to zero reports −100% but never
trips the guideline, which is about increases; coming back from zero has no
percentage at all, so it says "back" rather than inventing one; and the week
underway is shown but held out of the comparison until it finishes.

**Timezones, in both directions.** The calendar has none — every day is a plain
`YYYY-MM-DD` string, because a Tuesday morning run is Tuesday regardless of UTC
offset. The Sunday-afternoon summary unlock does need one, and it's anchored to
`America/New_York` rather than a fixed offset, since daylight saving ends
mid-season and a hardcoded UTC−5 would open it an hour early on one side of that
date.

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
