# Training Dashboard — spec

The working specification for this project: the stack, the scope that's settled,
and the constraints behind it. It's the reference I keep current as decisions
land, and it's what I point tooling at so implementation stays aligned with what
was actually agreed.

Rationale for individual choices lives in [DECISIONS.md](./DECISIONS.md); this
file records *what* was decided, that one records *why*.

## Stack
- Next.js 14 App Router (React 18 + TypeScript strict), Tailwind CSS
- PostgreSQL (Neon) + Prisma ORM
  - Persistence runs through a `Store` interface (`src/lib/store`) with two
    implementations: Postgres when `DATABASE_URL` is set, a file-backed JSON
    store otherwise. Local development needs no database.
- Vercel (deploy target)

## Data source: manual GPX upload (not Strava API)
- Strava's June 2026 developer program change requires an active Strava
  subscription to register *any* app, including Single Player Mode
  (personal-use-only) apps — confirmed via Strava's own developer docs. No workaround
  exists at the API level. Rather than pay for a subscription, the project uses
  manual GPX file export/upload instead of live OAuth sync.
- GPX export is free from both Strava (activity page → export menu, or append
  `/export_tcx` to an activity URL for TCX) and Garmin Connect (activity detail page →
  gear icon → export options). GPX is the more reliable format across both — TCX can
  export empty for some activities depending on the recording device.
- This also makes the app platform-agnostic: any GPX export works, not just Strava's.
- **No OAuth, no token storage, no refresh logic, no rate limits to manage.**
- HR is out of scope for v1 — not parsed or stored, even when present in the file.

## Project scope (settled)

### Main page — weekly plan (sliding calendar)
- Mon–Sun, **season start through season end** — originally "current week through
  end of season", widened once season start could be set in the past. Past weeks
  have to be reachable: that's where a completed week or a layoff lives, and the
  season chart already showed them. The range is always widened to contain the
  current week, so "jump to this week" works even if the season is entirely in
  the past or hasn't started.
- Left/right arrows for week navigation; loads to current week on open; current day highlighted
- Main page shows **plan only** — no actual/uploaded data is displayed here
- Per day, two sessions (AM / PM), each independently:
  - Off toggle (checking both AM and PM off = full rest day)
  - If not off: a mileage field (planned mileage)
  - "+" button reveals a free-text workout note field (no mileage split on the plan side —
    workout volume is captured later, on the actual/upload side, not planned in advance)

### File ingestion — whole-page drop zone
- The entire page (not individual day cells) accepts dropped GPX files
- Dropped files are **not matched to a specific day or session** — no date/session
  matching logic needed
- Each file is parsed for: distance, elevation gain, moving time
  - **Moving time, not elapsed** (decided): segments below 0.5 m/s are treated as
    stopped and excluded, as are sample gaps over 30s (paused watch / lost signal).
    Elapsed time is not stored. Weekly average pace derives from miles ÷ moving time.
  - Elevation gain uses a 1.5 m hysteresis filter so GPS/barometric jitter doesn't
    accumulate into phantom climb over a long run.
- **Week bucketing** (decided): a file lands in the week containing its own start
  timestamp. Files with no timestamps fall back to the week being viewed. This is
  week-granularity only — still no day or AM/PM matching.
- After a batch drop, show a single review screen (not one popup per file): each file
  listed with an "Is this a workout?" toggle; if yes, prompt for workout volume (miles)
- All of it rolls into a running **weekly aggregate**, not per-day data:
  - Total mileage
  - Total time (weekly average pace derived from mileage/time)
  - Elevation gain
  - Workout mileage (sum of volumes entered on flagged files)

### Progress bar
- **Cut (decided).** Removed entirely rather than built — the file-count ÷
  planned-session ratio was a weak signal given files are never matched to
  sessions. Its only structural role was gating the weekly summary link, which
  now has its own rule (below).

### Weekly summary
- The "weekly summary" link unlocks **Sunday at 1:00 pm Eastern** — you shouldn't
  rate a week that still has running left in it. Weeks already in the past are
  always open; future weeks never are.
  - Implemented against the `America/New_York` zone, not a fixed UTC offset, so
    it stays correct across the Nov 1 2026 DST change mid-season.
  - Enforced server-side (page + `PUT /api/summary`), not just by hiding the link.
- Clicking it opens a popup asking the user to rate eating, sleep, and school stress
  for the week
- **These ratings are stored raw, displayed alongside the stats — no formula or score
  is computed from them.** There's no defensible way to turn a subjective 1–5 into a
  training-load multiplier; the point is to let the user eyeball their own correlations
  over a season, not to fake a calculation.
- Submitting opens a new page showing: total mileage, total time, elevation gain,
  workout mileage (+ % of total weekly mileage), the week's ratings, and room for
  additional stats later
- A way back to the main sliding calendar from this page

### Outside the calendar
- ~~Shoe mileage tracker~~ — **cut (decided).** Manual mileage entry was a second
  data-entry chore competing with the GPX drop, and the whole point of the upload
  flow is that logging is one gesture. Not worth a recurring manual input.
- Season-to-date totals (mileage + time)
- Countdown to nationals

### Season overview (built)
- **Season mileage chart** on the main page: one column per week from season start
  to season end. Filled column = actual miles uploaded, thin marker = planned, both
  on one miles axis. Clicking a column jumps the calendar to that week.
- **Week-over-week ramp flag** (~10% rule) beside it, with the last four logged
  weeks and their deltas.
  - Computed on **actual** mileage. A week with no files **counts as zero and is
    shown** — time off for injury/illness is part of the season and must stay
    visible. (Reversed from an earlier "skip unlogged weeks" rule; see
    DECISIONS.md #9c.)
    - Dropping to zero reports a true −100% and gets its own neutral state; it
      never trips the guideline, which is about increases.
    - Coming back *from* zero has no percentage (infinite), so it shows "back".
    - The week underway is shown but excluded from the headline comparison.
  - **Dismissable** when a jump has a known cause (injury return, illness,
    intentional build) — one-click preset reasons, no typing. The dismissal is
    keyed to that specific week and is reversible, so a later genuine spike still
    fires and the history still shows what was waived.

### Stretch goals (post-v1, not required for launch)
- ~~Week-over-week ramp-rate flag~~ — **built** (see above).
- Plan-vs-actual adherence — partially built: the weekly summary shows % of planned
  mileage completed, and the season chart shows the two side by side. A dedicated
  adherence view is still open.
- ACWR (acute:chronic workload ratio) training-load metric — a real sports-science
  measure, but easy to get subtly wrong and misleading when it is. Only worth
  building carefully, after the core dashboard has a season of data behind it.

## Working conventions
- **Keep the decision log current.** Every non-obvious choice gets an entry in
  [DECISIONS.md](./DECISIONS.md) with what was considered, what was chosen, and
  why — including reversals, which are usually the more useful entries. The
  Strava-API-vs-GPX decision above is the model.
- **TypeScript strict, with `noUncheckedIndexedAccess`.** Type errors are cheaper
  than runtime ones; the compiler is the first reviewer.
- **Domain logic stays pure.** Unit conversion, weekly totals, ramp calculations
  and date math live in `src/lib/domain` and `src/lib/dates` as functions over
  plain data, with no I/O. They're the parts most worth getting right, and
  keeping them free of the store and the framework makes them directly testable.
- **Persistence goes through the `Store` interface**, never a database client
  directly. Routes, domain code and components should not know which backend is
  live.
- **Enforce rules on the server, not just in the UI.** Hiding a control is a
  suggestion; the route handler is the boundary that counts.