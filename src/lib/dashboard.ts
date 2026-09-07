import {
  currentWeekStart,
  daysUntil,
  mondayOf,
  todayIso,
  weekDays,
  weeksBetween,
  type IsoDate,
} from "@/lib/dates";
import {
  aggregateUploads,
  plannedSessionCount,
  plannedWeekMiles,
  rampRate,
  rampRows,
  seasonToDate,
  weeklySeries,
  type RampRate,
  type RampRow,
  type SeasonTotals,
  type WeekPoint,
  type WeeklyAggregate,
} from "@/lib/domain/totals";
import {
  store,
  type PlanEntry,
  type SeasonConfig,
  type UploadedActivity,
  type WeeklyReflection,
} from "@/lib/store";

export interface DashboardData {
  config: SeasonConfig;
  today: IsoDate;
  currentWeek: IsoDate;
  /** Every selectable week-start across the season; always includes this week. */
  weeks: IsoDate[];
  season: {
    totals: SeasonTotals;
    daysToNationals: number;
    nationalsDate: IsoDate;
  };
  /** Planned vs actual mileage per week — the season chart's series. */
  series: WeekPoint[];
  ramp: RampRate;
  /** Per-week ramp rows for every logged week, newest last. */
  rampRows: RampRow[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const [config, uploads, plan, acks] = await Promise.all([
    store.getConfig(),
    store.listUploads(),
    store.listAllPlanEntries(),
    store.listRampAcks(),
  ]);

  // One week range for the whole dashboard — the calendar nav, the chart, and
  // the ramp all agree on which weeks exist. It spans the configured season and
  // is widened to always contain the current week, so "jump to this week" works
  // even if the season is entirely in the past or hasn't started yet.
  const thisWeek = currentWeekStart();
  const seasonStart = mondayOf(config.seasonStartDate);
  const seasonEnd = mondayOf(config.seasonEndDate);

  const weeks = weeksBetween(
    seasonStart < thisWeek ? seasonStart : thisWeek,
    seasonEnd > thisWeek ? seasonEnd : thisWeek,
  );
  const series = weeklySeries(weeks, plan, uploads);

  return {
    config,
    today: todayIso(),
    currentWeek: currentWeekStart(),
    weeks,
    season: {
      totals: seasonToDate(uploads, config.seasonStartDate, config.seasonEndDate),
      daysToNationals: daysUntil(config.nationalsDate),
      nationalsDate: config.nationalsDate,
    },
    series,
    ramp: rampRate(series, acks),
    rampRows: rampRows(series, acks),
  };
}

/**
 * A week's plan (what the main calendar renders) plus the uploaded-file
 * aggregate (which the calendar deliberately does NOT show — it's for the
 * weekly summary page).
 */
export interface WeekView {
  weekStart: IsoDate;
  days: IsoDate[];
  plan: PlanEntry[];
  plannedMiles: number;
  plannedSessions: number;
  uploads: UploadedActivity[];
  aggregate: WeeklyAggregate;
  reflection: WeeklyReflection | null;
}

export async function getWeekView(rawWeekStart: IsoDate): Promise<WeekView> {
  const weekStart = mondayOf(rawWeekStart);

  const [plan, uploads, reflection] = await Promise.all([
    store.listPlanEntries(weekStart),
    store.listUploadsForWeek(weekStart),
    store.getReflection(weekStart),
  ]);

  return {
    weekStart,
    days: weekDays(weekStart),
    plan,
    plannedMiles: plannedWeekMiles(plan),
    plannedSessions: plannedSessionCount(plan),
    uploads,
    aggregate: aggregateUploads(uploads),
    reflection,
  };
}
