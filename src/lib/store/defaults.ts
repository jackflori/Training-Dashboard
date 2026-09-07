import type { IsoDate } from "@/lib/dates";
import type { SeasonConfig } from "./types";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Read an ISO date from env, falling back if unset/malformed. */
function envDate(key: string, fallback: IsoDate): IsoDate {
  const v = process.env[key];
  return v && ISO_RE.test(v) ? v : fallback;
}

/**
 * Seeded the first time config is read. These are only defaults — the values
 * are editable in the UI (Season settings) and persisted thereafter. Shared by
 * every Store implementation so a backend swap can't change the starting state.
 */
export function defaultConfig(): SeasonConfig {
  const nationalsDate = envDate("NATIONALS_DATE", "2026-11-21");
  return {
    nationalsDate,
    seasonStartDate: envDate("SEASON_START_DATE", "2026-09-01"),
    seasonEndDate: envDate("SEASON_END_DATE", nationalsDate),
  };
}
