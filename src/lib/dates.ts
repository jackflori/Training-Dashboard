import {
  addDays,
  addWeeks as dfAddWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";

/**
 * Calendar helpers. The whole app treats a "day" as a plain ISO date string
 * (YYYY-MM-DD) so we never have to reason about timezones for the grid. Weeks
 * run Monday -> Sunday.
 */

export type IsoDate = string; // "2026-09-07"

const WEEK_OPTS = { weekStartsOn: 1 as const }; // 1 = Monday

export function toIsoDate(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

/** Parse an ISO date string into a Date at local midnight. */
export function fromIsoDate(iso: IsoDate): Date {
  return parseISO(iso);
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

/** ISO date of the Monday that starts the week containing `iso`. */
export function mondayOf(iso: IsoDate): IsoDate {
  return toIsoDate(startOfWeek(fromIsoDate(iso), WEEK_OPTS));
}

export function currentWeekStart(now: Date = new Date()): IsoDate {
  return toIsoDate(startOfWeek(now, WEEK_OPTS));
}

export function addWeeks(isoWeekStart: IsoDate, n: number): IsoDate {
  return toIsoDate(dfAddWeeks(fromIsoDate(isoWeekStart), n));
}

/** The seven ISO dates Mon..Sun for a given week. */
export function weekDays(isoWeekStart: IsoDate): IsoDate[] {
  const monday = fromIsoDate(isoWeekStart);
  return Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)));
}

/**
 * Every week-start from the week containing `startIso` through the week
 * containing `endIso`, inclusive.
 *
 * This is the range the season chart and the ramp use — unlike the calendar
 * nav, they must include weeks already behind us, so a week off (injury,
 * illness) stays visible in the season record instead of vanishing.
 */
export function weeksBetween(startIso: IsoDate, endIso: IsoDate): IsoDate[] {
  const first = mondayOf(startIso);
  const last = mondayOf(endIso);
  if (fromIsoDate(last) < fromIsoDate(first)) return [first];

  const weeks: IsoDate[] = [];
  let cursor = first;
  while (fromIsoDate(cursor) <= fromIsoDate(last)) {
    weeks.push(cursor);
    cursor = addWeeks(cursor, 1);
  }
  return weeks;
}

/**
 * Every week-start from the current week through the week that contains
 * `seasonEnd`. This is the "sliding" range the calendar nav is clamped to.
 */
export function seasonWeeks(seasonEnd: IsoDate, now: Date = new Date()): IsoDate[] {
  const first = currentWeekStart(now);
  const last = mondayOf(seasonEnd);
  const weeks: IsoDate[] = [];
  let cursor = first;
  // Guard against a season end in the past.
  if (fromIsoDate(last) < fromIsoDate(first)) return [first];
  while (fromIsoDate(cursor) <= fromIsoDate(last)) {
    weeks.push(cursor);
    cursor = addWeeks(cursor, 1);
  }
  return weeks;
}

export function isToday(iso: IsoDate, now: Date = new Date()): boolean {
  return iso === toIsoDate(now);
}

/** Whole calendar days from today until `iso` (negative if in the past). */
export function daysUntil(iso: IsoDate, now: Date = new Date()): number {
  return differenceInCalendarDays(fromIsoDate(iso), now);
}

export function isWithin(iso: IsoDate, startIso: IsoDate, endIso: IsoDate): boolean {
  const d = fromIsoDate(iso).getTime();
  return d >= fromIsoDate(startIso).getTime() && d <= fromIsoDate(endIso).getTime();
}

/**
 * The weekly summary unlocks on Sunday afternoon — you shouldn't be rating a
 * week that still has running left in it.
 *
 * Anchored to America/New_York rather than a fixed UTC offset so it keeps
 * meaning 1pm local across the DST change (Nov 1, 2026), which falls mid-season.
 * A week that has already ended is always open.
 */
export const SUMMARY_UNLOCK_HOUR_ET = 13;

const ET_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

/** "Now" as seen from Eastern time: its calendar date and its hour. */
function easternNow(now: Date): { date: IsoDate; hour: number } {
  const parts = ET_PARTS.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const rawHour = Number(get("hour"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    // Intl renders midnight as "24" in hour12:false on some engines.
    hour: rawHour === 24 ? 0 : rawHour,
  };
}

export function isSummaryUnlocked(isoWeekStart: IsoDate, now: Date = new Date()): boolean {
  const sunday = weekDays(isoWeekStart)[6]!;
  const { date: etToday, hour: etHour } = easternNow(now);

  // ISO dates compare correctly as strings.
  if (sunday < etToday) return true; // week is over
  if (sunday > etToday) return false; // week hasn't ended yet
  return etHour >= SUMMARY_UNLOCK_HOUR_ET; // it's Sunday — wait for 1pm ET
}

export function formatWeekRange(isoWeekStart: IsoDate): string {
  const days = weekDays(isoWeekStart);
  const start = fromIsoDate(days[0]!);
  const end = fromIsoDate(days[6]!);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "MMM d")} – ${format(end, "d")}`
    : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

export function formatDayLabel(iso: IsoDate): string {
  return format(fromIsoDate(iso), "EEE M/d");
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
