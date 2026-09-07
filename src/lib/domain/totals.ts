import { currentWeekStart, isWithin, weekDays, type IsoDate } from "@/lib/dates";
import type { PlanEntry, RampAck, UploadedActivity } from "@/lib/store";

import { formatPacePerMile, metersToFeet, metersToMiles } from "./activity";

/**
 * The weekly aggregate. Per the locked scope, uploaded files roll up to this —
 * there is no per-day actual data.
 */
export interface WeeklyAggregate {
  fileCount: number;
  miles: number;
  movingSeconds: number;
  elevationGainFeet: number;
  /** Sum of volumes entered on files flagged as workouts. */
  workoutMiles: number;
  /** workoutMiles as a share of total miles, 0-100. null when no miles yet. */
  workoutSharePct: number | null;
  /** Weekly average pace, derived from total miles / total moving time. */
  averagePace: string | null;
}

export function aggregateUploads(uploads: UploadedActivity[]): WeeklyAggregate {
  let meters = 0;
  let movingSeconds = 0;
  let elevationMeters = 0;
  let workoutMiles = 0;

  for (const u of uploads) {
    meters += u.distanceMeters;
    movingSeconds += u.movingSeconds;
    elevationMeters += u.elevationGainMeters;
    if (u.isWorkout) workoutMiles += u.workoutMiles ?? 0;
  }

  const miles = metersToMiles(meters);
  return {
    fileCount: uploads.length,
    miles,
    movingSeconds,
    elevationGainFeet: metersToFeet(elevationMeters),
    workoutMiles,
    workoutSharePct: miles > 0 ? (workoutMiles / miles) * 100 : null,
    averagePace: formatPacePerMile(meters, movingSeconds),
  };
}

/** Total planned mileage for a week — off slots contribute nothing. */
export function plannedWeekMiles(entries: PlanEntry[]): number {
  return entries.reduce((sum, e) => (e.off ? sum : sum + (e.miles ?? 0)), 0);
}

/** Count of planned sessions that aren't marked off. */
export function plannedSessionCount(entries: PlanEntry[]): number {
  return entries.filter((e) => !e.off && (e.miles ?? 0) > 0).length;
}

export interface WeekPoint {
  weekStart: IsoDate;
  plannedMiles: number;
  actualMiles: number;
  /** True once the week has any uploaded file. */
  hasUploads: boolean;
}

/**
 * Planned vs actual mileage for every week in the season — the season chart's
 * series. Weeks with no data still appear, so the ramp reads as a shape rather
 * than a gap-free line that hides missing weeks.
 */
export function weeklySeries(
  weeks: IsoDate[],
  plan: PlanEntry[],
  uploads: UploadedActivity[],
): WeekPoint[] {
  const plannedByWeek = new Map<IsoDate, number>();
  for (const e of plan) {
    if (e.off) continue;
    plannedByWeek.set(
      e.isoWeekStart,
      (plannedByWeek.get(e.isoWeekStart) ?? 0) + (e.miles ?? 0),
    );
  }

  const actualByWeek = new Map<IsoDate, { miles: number; count: number }>();
  for (const u of uploads) {
    const cur = actualByWeek.get(u.isoWeekStart) ?? { miles: 0, count: 0 };
    cur.miles += metersToMiles(u.distanceMeters);
    cur.count += 1;
    actualByWeek.set(u.isoWeekStart, cur);
  }

  return weeks.map((weekStart) => {
    const actual = actualByWeek.get(weekStart);
    return {
      weekStart,
      plannedMiles: plannedByWeek.get(weekStart) ?? 0,
      actualMiles: actual?.miles ?? 0,
      hasUploads: (actual?.count ?? 0) > 0,
    };
  });
}

export type RampStatus =
  | "ok"
  | "high"
  | "acknowledged"
  | "returning"
  /** Completed week with no mileage at all — time off, not a ramp verdict. */
  | "zero"
  | "insufficient";

export interface RampRow {
  weekStart: IsoDate;
  miles: number;
  /**
   * Percent change vs the previous week. Null when undefined — the first week
   * of the season, or coming back from a zero week (any increase from zero is
   * infinite, not a percentage).
   */
  changePct: number | null;
  overLimit: boolean;
  acknowledged: boolean;
  /** Why the jump was expected, when one was given. */
  reason: string | null;
  /** No files uploaded for this week — the mileage is a real zero. */
  isZero: boolean;
  /** First week back after one or more zero weeks. */
  returning: boolean;
  /** The week still underway; its mileage isn't final. */
  inProgress: boolean;
}

export interface RampRate {
  status: RampStatus;
  changePct: number | null;
  previousMiles: number;
  currentMiles: number;
  previousWeek: IsoDate | null;
  currentWeek: IsoDate | null;
  /** Set when status is "acknowledged". */
  reason: string | null;
}

/** The conventional "don't add more than ~10% a week" injury heuristic. */
export const RAMP_LIMIT_PCT = 10;

/**
 * Per-week ramp rows, every week from season start through the current week.
 *
 * A week with no uploads counts as a real zero rather than being skipped: time
 * off for injury or illness is part of the season's shape and should be visible
 * in the record, not silently omitted.
 *
 * Two consequences that have to be handled rather than papered over:
 *  - Dropping to zero is a true -100%, and it is reported as such. It never
 *    trips the guideline, which is about *increases* — a drop isn't a ramp risk.
 *  - Coming back *from* zero has no percentage at all (any increase from zero is
 *    infinite), so those weeks are marked `returning` instead of carrying a
 *    fabricated number.
 *
 * Future weeks are excluded — they'd all read as zero and mean nothing.
 */
export function rampRows(
  series: WeekPoint[],
  acks: RampAck[] = [],
  now: Date = new Date(),
): RampRow[] {
  const ackByWeek = new Map(acks.map((a) => [a.isoWeekStart, a]));
  const thisWeek = currentWeekStart(now);
  const upto = series.filter((w) => w.weekStart <= thisWeek);

  return upto.map((w, i) => {
    const prev = upto[i - 1];
    const isZero = !w.hasUploads || w.actualMiles <= 0;

    let changePct: number | null = null;
    let returning = false;
    if (prev) {
      if (prev.actualMiles > 0) {
        changePct = ((w.actualMiles - prev.actualMiles) / prev.actualMiles) * 100;
      } else if (w.actualMiles > 0) {
        returning = true;
      }
    }

    const ack = ackByWeek.get(w.weekStart);
    return {
      weekStart: w.weekStart,
      miles: w.actualMiles,
      changePct,
      overLimit: changePct !== null && changePct > RAMP_LIMIT_PCT,
      acknowledged: ack !== undefined,
      reason: ack?.reason ?? null,
      isZero,
      returning,
      inProgress: w.weekStart === thisWeek,
    };
  });
}

/**
 * The headline week-over-week ramp: the last two *completed* weeks.
 *
 * The week underway is excluded on purpose — a Wednesday has only part of its
 * mileage in, so comparing it to a finished week would report an alarming drop
 * every few days. It still appears in the rows, flagged `inProgress`.
 */
export function rampRate(
  series: WeekPoint[],
  acks: RampAck[] = [],
  now: Date = new Date(),
): RampRate {
  const rows = rampRows(series, acks, now).filter((r) => !r.inProgress);
  const current = rows.at(-1);
  const previous = rows.at(-2);

  const empty: RampRate = {
    status: "insufficient",
    changePct: null,
    previousMiles: previous?.miles ?? 0,
    currentMiles: current?.miles ?? 0,
    previousWeek: previous?.weekStart ?? null,
    currentWeek: current?.weekStart ?? null,
    reason: null,
  };

  if (!current || !previous) return empty;

  // Back from a layoff: real, worth surfacing, but not a percentage.
  if (current.returning) {
    return { ...empty, status: "returning", currentMiles: current.miles };
  }

  // Two zero weeks in a row — nothing to compare.
  if (current.changePct === null) return empty;

  // A week off isn't a verdict on ramping. Report the drop without calling it
  // either good ("within the guideline") or risky.
  if (current.isZero) {
    return {
      ...empty,
      status: "zero",
      changePct: current.changePct,
      previousMiles: previous.miles,
      currentMiles: current.miles,
    };
  }

  const status: RampStatus = !current.overLimit
    ? "ok"
    : current.acknowledged
      ? "acknowledged"
      : "high";

  return {
    status,
    changePct: current.changePct,
    previousMiles: previous.miles,
    currentMiles: current.miles,
    previousWeek: previous.weekStart,
    currentWeek: current.weekStart,
    reason: current.reason,
  };
}

export interface SeasonTotals {
  miles: number;
  movingSeconds: number;
  elevationGainFeet: number;
}

/**
 * Season-to-date totals. A week counts if its Monday falls inside the season
 * range — uploads are bucketed by week, so week-start is the right granularity.
 */
export function seasonToDate(
  uploads: UploadedActivity[],
  seasonStart: IsoDate,
  seasonEnd: IsoDate,
): SeasonTotals {
  const inRange = uploads.filter((u) => {
    const days = weekDays(u.isoWeekStart);
    // Include the week if any of its days overlap the season window.
    return days.some((d) => isWithin(d, seasonStart, seasonEnd));
  });

  const agg = aggregateUploads(inRange);
  return {
    miles: agg.miles,
    movingSeconds: agg.movingSeconds,
    elevationGainFeet: agg.elevationGainFeet,
  };
}
