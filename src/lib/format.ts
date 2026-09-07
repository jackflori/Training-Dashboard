import { formatDuration } from "@/lib/domain/activity";

/** "32.4 mi" */
export function miles(value: number, digits = 1): string {
  return `${value.toFixed(digits)} mi`;
}

/** "4:12:30" */
export function duration(seconds: number): string {
  return formatDuration(seconds);
}

/** "1,240 ft" */
export function feet(value: number): string {
  return `${Math.round(value).toLocaleString()} ft`;
}
