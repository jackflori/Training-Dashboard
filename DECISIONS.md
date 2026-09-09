# Decision log

A running record of the design choices behind this project: what was considered,
what was chosen, and why. Entries are written at the time the decision is made,
including the ones that were later reversed — the reversals are usually the more
useful half.

---

## 1. Data source: manual GPX upload, not the Strava API

**Considered:** live Strava OAuth sync vs. manual GPX file upload.

**Chose:** GPX upload.

**Why:** Strava's June 2026 developer-program change requires an active paid
subscription to register *any* app, including personal Single Player Mode ones.
Registering is otherwise trivial (5-minute form, no review queue, immediate
client id/secret) — the subscription is the whole blocker, and there's no
API-level workaround.

Beyond the cost, GPX turned out to be the better call on its own merits:

- **Platform-agnostic.** Any GPX export works — Strava, Garmin Connect, COROS.
  The app isn't hostage to one vendor's API terms.
- **No moving parts to break.** No tokens to refresh, no revocation handling, no
  rate limits, no OAuth callback domains to keep in sync between dev and prod.
  A hosted demo shouldn't stop working because a third-party grant lapsed.
- **The harder, more interesting problem.** An OAuth integration is mostly
  following a provider's documentation correctly. Parsing an XML track,
  deriving distance from lat/lon with haversine, separating moving time from
  elapsed, and filtering barometric noise out of elevation gain are real
  problems with real edge cases — and they're the ones this app is actually
  about.

**Cost:** the API integration was already built when this landed — roughly 800
lines of authorize/callback routes, proactive token refresh, revocation
handling, and a typed client. All of it was deleted rather than kept "in case."

Two things made that cheap enough to be worth doing. The OAuth layer was
isolated behind its own module, so removing it touched the routes that called it
and nothing else. And the sunk cost was genuinely irrelevant — the code could not
run without a subscription, so keeping it would have meant carrying dead weight
to avoid admitting the weight was dead.

The transferable lesson is about sequencing, not Strava: the platform constraint
(*can I even register an app?*) was answerable in five minutes and was checked
after the integration was written rather than before. Cheap questions that can
invalidate expensive work belong first.

## 2. Moving time, not elapsed time

**Considered:** elapsed (last timestamp − first) vs. moving (sum of segments
above a speed threshold) vs. storing both.

**Chose:** moving time only.

**Why:** Elapsed time is trivially computed but nearly useless for training load
— one long water stop or a watch left running after the cooldown inflates it and
drags weekly average pace down with it. Two guards make moving time robust:

- Segments under **0.5 m/s** (~32:00/mi — slower than any real running or even
  brisk walking) count as stopped.
- Sample gaps over **30 s** are skipped entirely: the watch was paused or lost
  signal, and neither interpretation should add to moving time.

Verified against a synthetic GPX with known ground truth: a 20-minute run at
3.0 m/s with a 3-minute standing stop parsed to exactly 1200 s moving (not the
1380 s elapsed), 3600.0 m, and 8:56/mi.

## 3. Elevation gain: hysteresis filter, not raw sum

**Chose:** track the last *confirmed* altitude and only bank a change once it
exceeds **1.5 m**.

**Why:** GPS and barometric altimeters jitter a metre or two even standing
still. Naively summing every positive delta over a 1-second-sampled hour-long
run accumulates hundreds of feet of climb that never happened. Confirmed by the
test file: 180 s of ±0.5 m noise while stationary contributed 0.5 m of phantom
gain instead of ~45 m.

## 4. Week bucketing from the file's own timestamp

**Chose:** a dropped file lands in the week containing its GPX start time; files
with no timestamps fall back to the week currently being viewed.

**Why:** By design, files aren't matched to a day or session — but
they still have to land in *some* week to roll up. Reading it from the file is
both more accurate and less surprising than "whatever week you happened to be
looking at," and it means dropping a backlog of files at the end of a week
distributes them correctly instead of piling them into one bucket. The viewed
week is a sensible fallback for the rare timestamp-less export.

## 5. Progress bar: cut, not built

**Chose:** removed from scope entirely.

**Why:** Files are never matched to sessions, so a "3 of 5 sessions done" bar
built from two independent counts implies a correspondence that doesn't exist —
drop three files on a five-session week and it reads 60% regardless of which
sessions they were. Its only structural role was gating the weekly summary link,
which now has a rule of its own (#6). Cutting it removed a feature that would
have been actively misleading.

## 5b. Shoe mileage tracker: cut

**Chose:** removed entirely — component, `/api/shoes` routes, `Shoe` model,
domain logic, and the two threshold fields in Season settings.

**Why:** It was the only feature in the app requiring recurring manual data
entry, and it competed directly with the thing the app is built around: logging
a run is supposed to be one gesture (drop a file). A tracker that only stays
accurate if you remember to tap "+5" after every run is a tracker that silently
goes wrong. Better to have no number than a stale one.

Worth noting it can't be derived from the GPX side either — files carry no gear
association, so there'd be nothing to attribute miles to without asking. That
made it manual-or-nothing, and nothing won.

**Cost of the cut:** small, because it sat behind the same `Store` interface as
everything else — deleting it was four files plus the config fields, with no
changes to the upload, plan, or summary paths.

## 6. Weekly summary unlocks Sunday 1pm Eastern

**Considered:** always available; gated on the (now-cut) progress bar; gated on
the calendar week ending.

**Chose:** unlocks Sunday at 1:00 pm ET for the current week. Past weeks are
always open; future weeks never are.

**Why:** You shouldn't be rating eating/sleep/stress for a week that still has
running left in it. Sunday afternoon is when the week is effectively done.

Two implementation notes worth keeping:

- Anchored to the **`America/New_York` zone**, not a hardcoded UTC−5. DST ends
  Nov 1 2026, mid-season — a fixed offset would unlock an hour early on one side
  of that date. Covered by a boundary test on both sides of the transition.
- **Enforced server-side**, on both the page and `PUT /api/summary`, not just by
  hiding the link. A UI-only gate is a suggestion.

## 7. Ratings stored raw, never scored

**Chose:** eating / sleep / school stress are stored as three 1–5 integers and
displayed as-is next to the week's stats. Nothing is computed from them.

**Why:** Settled early, and worth restating because it's the
kind of thing that invites a bad feature. There's no defensible way to turn a
subjective 1–5 into a training-load multiplier — any formula would be invented
precision. The value is in eyeballing your own correlations across a season, not
in a fake composite score.

## 8. Persistence behind an interface, file store first

**Considered:** (a) stand up Neon + Prisma immediately; (b) `localStorage`; (c) a
file-backed store behind an interface.

**Chose:** (c) — `src/lib/store` defines a `Store` interface; `JsonStore` writes
`data/store.json` with atomic temp-file renames and an in-process write queue to
serialise concurrent mutations.

**Why:** the app needed to be usable before the data model was settled, and
standing up Postgres first would have meant designing a schema around features
that didn't exist yet. An interface with one swappable implementation deferred
that without painting anything into a corner: nothing in the routes, domain
logic, or UI knows which backend is live. `prisma/schema.prisma` was written up
front anyway, so the target shapes stayed reviewable while the file store ran.
`localStorage` was out because totals are computed server-side.

**How it played out:** the swap to Postgres later cost one new file
(`prisma-store.ts`) plus one line in `src/lib/store/index.ts`, which now picks
the backend on whether `DATABASE_URL` is set. No route, component, or domain
function changed. See #14.

## 9. Main calendar is plan-only

**Chose:** the calendar renders the plan and nothing else. Uploaded data appears
only on the weekly summary page.

**Why:** Straight from the original scope, and it held up: the calendar is a
*planning* surface, and mixing in actuals would turn it into a Strava clone. The
one concession is a planned-mileage line under the grid, which is still plan-side
data.

## 9b. Season chart: one axis, planned as a target marker

**Considered:** grouped columns (planned beside actual); two lines; a dual-axis
chart; actual columns with planned as a marker.

**Chose:** actual as the column, planned as a thin marker at the same height on
the **same miles axis**.

**Why:** Grouped columns double the mark count for a comparison that's really
"did I hit the number?" — a target marker answers that at a glance. Both series
are miles, so they share one axis; a second y-scale would let the two be drawn to
different scales and invite a false read.

Detail worth keeping: **columns are capped at 24px** rather than filling their
slot. The leftover band is deliberate air — filling the slot makes a bar chart
read as a solid block and loses the per-week rhythm.

## 9c. An unlogged week counts as zero (reversed)

**First built:** weeks with no uploads were *skipped* — not compared, not shown.
The reasoning was that treating an unlogged week as 0 produces a -100% crash and
then a +∞ spike, two alarming numbers describing nothing but a gap in
record-keeping.

**Reversed to:** an unlogged week is a real zero, shown in the record.

**Why the reversal:** the original framing assumed a zero week means *missing
data*. For a single athlete who logs consistently, it far more often means
**time off** — injury, illness — and that is exactly the part of a season you
most want to see later. Skipping it made the app quietly erase the most
significant weeks of a setback. "The data is missing" was the wrong default;
"you didn't run" is the right one.

The original objection was real, though, so both halves are handled explicitly
rather than averaged away:

- **Dropping to zero** is a true -100% and is reported as such. It never trips
  the guideline, which is about *increases* — a drop isn't a ramp risk. It also
  gets its own status (`zero`) so the card says "No mileage logged that week"
  in neutral ink instead of a green check reading "Within the 10% guideline",
  which is a grim thing to show someone who just got hurt.
- **Coming back from zero** has no percentage at all — any increase from zero is
  infinite — so those weeks are marked `returning` and show "back" rather than a
  fabricated number. The week *after* a comeback compares normally, and that's
  where a genuine ramp gets caught (11 → 18 mi reads +64% and flags).
- **The week underway is excluded from the headline** and labelled "in progress"
  in the list. A partial week compared against a finished one would report an
  alarming drop every few days.

Planned mileage was rejected as the basis throughout: ramping is an injury-risk
heuristic about what the legs actually absorbed, not what was intended.

**Bug this surfaced:** `seasonWeeks()` builds its range from the *current* week
forward, and the season chart was using it — so weeks already behind us were
absent from both the chart and the ramp entirely. Time off would have vanished
rather than showing as zero. Added `weeksBetween(start, end)` for the chart and
ramp (full season, past included) and left `seasonWeeks` to the calendar nav,
where "current week → season end" was the original scope. It went unnoticed
because the seeded test data happened to start in the same week as "today".

## 9d. Ramp alerts are dismissable, per week

**Chose:** a flagged jump can be dismissed, optionally with a reason (injury
return / illness / intentional build, or none). The acknowledgement is keyed to
the **later week of the compared pair**, and is reversible.

**Why:** Not every jump is a mistake. Coming back from a layoff, the first weeks
*are* a big percentage increase, and that's the plan, not a warning. An alert
that can't be cleared is one you learn to ignore — and an ignored warning is
worse than none, because it trains you past the real ones.

The per-week keying is the part that matters. Silencing "the ramp alert"
globally would mean a genuine spike three weeks later goes unseen. Verified
against the case that would break it: with week 9/21 dismissed, a subsequent
+19% jump in 9/28 still fires, and the dismissed week's own row drops from the
warning color to muted rather than disappearing — the history stays honest about
what happened and what was waived.

The reason is captured as one-click presets rather than free text, deliberately:
the shoe tracker was cut for being a recurring manual-input chore (#5b), and a
dismissal shouldn't reintroduce typing. Presets cover the cases that actually
recur, and "No reason" is always available.

## 9e. One week range for the whole dashboard

**Was:** the calendar nav ran current week → season end (`seasonWeeks`), while
the season chart and ramp ran season start → season end (`weeksBetween`). Two
ranges, two sources of truth.

**Now:** one range, spanning the season and always widened to contain the current
week. The nav, the chart, and the ramp all agree on which weeks exist.

**Why:** the split produced a genuine dead end. Clicking a past column in the
season chart jumped the calendar to that week — but that week wasn't in the nav's
array, so `indexOf` returned -1 and *both* arrows disabled. You could reach a
week you then couldn't navigate out of except via "jump to this week". Setting
the season start in the past made it worse: the chart showed those weeks and the
calendar refused to open them.

The "current week → season end" clamp came from the original scope, which
predates both the season chart and an editable season start. Once you can point
the season at the past, refusing to navigate there is just a bug wearing a spec
as a hat.

Widening to include the current week is what keeps the two degenerate cases
working: a season entirely in the past, or one that hasn't started. Both were
verified — without it, `weeks` wouldn't contain `currentWeek` and the nav would
dead-lock the same way.

## 10. Framework versions: Next.js 14 + React 18, not 15/19

**Chose:** Next 14.2.35 (patched for the Dec 2025 advisory) + React 18.

**Why:** Stability over novelty. React 19's async-transition changes and Next
15's caching-default flip add moving parts to explain and debug for no benefit
here. Every pattern in this codebase — route handlers, `force-dynamic`, the
server/client component split — is documentation-stable on 14.2.

## 11. Error handling: typed errors → one `handle()` wrapper

**Chose:** domain errors (`GpxParseError`, `StoreError`, `ZodError`) are thrown
freely; `handle()` in `src/lib/api.ts` maps them to `{ error: { code, message } }`
plus the right status. The client's `api()` helper re-inflates them into
`ApiError` carrying the `code`, so components can branch on it.

**Why:** Route bodies stay one-line happy paths and the error contract is defined
once across ten endpoints.

**Related:** a batch upload doesn't fail on one bad file. Parse errors are
collected per-file and returned in `rejected[]` alongside `created[]`, so the
review screen can show "these four landed, this one wasn't a GPX."

## 12. Styling: semantic Tailwind tokens

**Chose:** `tailwind.config.ts` maps `surface`, `ink`, `accent`, `warn`, `danger`
to CSS custom properties in `globals.css`, with a `prefers-color-scheme: dark`
override block. Components only reference the semantic names.

**Why:** Dark mode for free, no raw hex scattered across a dozen components, one
place to retune the palette.

## 13. All API routes `force-dynamic`

**Chose:** every route handler exports `export const dynamic = "force-dynamic"`.

**Why:** They read the filesystem store. Without the flag Next tried to evaluate
the pure-GET ones at build time, which both bakes in stale data and crashed the
build. Explicit beats relying on Next's heuristic.

## 13b. "Today" resolves in the athlete's timezone, not the server's

**Bug:** in production the calendar highlighted tomorrow from 8pm onward. At
9:52pm Eastern the app showed Wednesday, because the server clock read
01:52 Wednesday UTC.

**Cause:** `todayIso()` formatted `new Date()` with date-fns, which uses the
*system* timezone. Locally that's Eastern, so it looked correct through all of
development. Vercel runs in UTC, so it was wrong for the last four hours of
every day — and `currentWeekStart()` had the same flaw, meaning late Sunday
evening the whole dashboard would jump to next week.

**Fix:** one `zonedNow()` helper resolves the calendar date and hour through
`Intl.DateTimeFormat` with an explicit `America/New_York`, and `todayIso`,
`currentWeekStart`, `isToday`, `daysUntil` and the summary unlock all derive
from it. Verified by running the same instants with the process in UTC,
Eastern, and Tokyo — identical results in all three.

**Why it's worth recording:** the codebase already had this exact rule, and only
applied it in one place. The summary unlock was carefully anchored to
`America/New_York` (#6) while everything else quietly used system time. Getting
the hard case right and leaving the easy one on a default is a recognisable
shape of bug — the rule was understood, it just wasn't applied uniformly.

It also only reproduces in an environment that differs from the development
machine, in a four-hour window. Locally it was invisible.

## 14. Postgres, chosen by environment rather than by build

**Chose:** `PrismaStore` implements the same `Store` interface as `JsonStore`,
and `src/lib/store/index.ts` picks between them on whether `DATABASE_URL` is
set — Postgres in production, the file store locally.

**Why the swap happened at all:** the file store worked fine locally and would
have kept working indefinitely. Deploying is what forced it. Serverless
functions run on a read-only filesystem apart from `/tmp`, and the store writes
into the deployment bundle — so every write would have failed in production
while local development looked perfect. This is the class of bug that only
appears at the platform boundary, which is a decent argument for deploying
earlier rather than later.

**Why a runtime switch instead of replacing the file store:** local development
needs no database, no connection string, and no network. Keeping both and
choosing at runtime preserves that, and it also means the file store stays
exercised rather than rotting as dead code.

Two details worth keeping:

- **Migrations run in the build** (`scripts/prisma-migrate.mjs`), guarded on
  `DATABASE_URL` so a local build with no database still succeeds. Prisma's
  `postinstall` only generates the *client* — without a separate migrate step, a
  deploy carrying a schema change builds green and then fails at runtime against
  columns that don't exist. A failed migration fails the build, which leaves the
  previous deployment serving.
- **Pooled connection for the app, direct for migrations.** Serverless opens many
  short-lived connections, which is what the pooler is for; migrations need a
  real session, hence `directUrl`.

## 15. A single shared password, not a user system

**Chose:** reads are public; writes require a session cookie obtained by posting
one shared password. HMAC-signed, `httpOnly`, 30-day expiry.

**Why:** there is exactly one athlete. Accounts, registration, password reset,
and email verification would all be ceremony around a table with one row. But
"no auth at all" stopped being viable at deploy: anyone with the URL could edit
the training plan, upload files, or change the season config. The gate exists to
stop that, not to model identity.

Reads stay open deliberately — the dashboard is meant to be shareable, and a
visitor should see the season without being asked for anything.

**Fails safe.** With no password configured, the app is permissive in
development (so local work needs no setup) but denies writes in production. A
deploy that forgets the environment variable ends up read-only rather than
world-writable — the failure mode points at "too locked" instead of "wide open."

## Open / deferred

- **Nationals + season dates** are seeded from env and editable in Settings, but
  the real dates still need to be entered.
- **Preview deployments share the production database.** Fine for solo work, but
  a schema change pushed to a branch would migrate real data. Neon's database
  branching is the fix if that ever matters.
- **Stretch goals** from the original scope — plan-vs-actual adherence beyond the
  percentage already on the summary page, and ACWR (acute:chronic workload ratio)
  — remain unbuilt by design. ACWR in particular is easy to get subtly wrong and
  wasn't worth shipping half-right.
