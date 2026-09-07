export const METERS_PER_MILE = 1609.344;
export const FEET_PER_METER = 3.28084;

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

export function metersToFeet(m: number): number {
  return m * FEET_PER_METER;
}

/** Seconds -> "H:MM:SS" (drops the hour when zero). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(sec).padStart(2, "0")}`
    : `${mm}:${String(sec).padStart(2, "0")}`;
}

/** Minutes-per-mile pace, e.g. "7:32". Returns null when undefined. */
export function formatPacePerMile(meters: number, movingSeconds: number): string | null {
  const miles = metersToMiles(meters);
  if (miles < 0.01 || movingSeconds <= 0) return null;
  const secPerMile = movingSeconds / miles;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  // Handle rounding 59.5 -> 60.
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
