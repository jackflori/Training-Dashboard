"use client";

import { useState } from "react";

import { formatWeekRange, type IsoDate } from "@/lib/dates";
import type { WeekPoint } from "@/lib/domain/totals";
import { Card } from "./ui";

const PLOT_HEIGHT = 168; // px

/**
 * Axis scale. Steps by a clean interval and rounds the top up to a multiple of
 * it, so ticks land on 0 / 10 / 20 / 30 rather than 0 / 13 / 25 / 38.
 */
function axisScale(peak: number): { max: number; ticks: number[] } {
  const step = peak <= 20 ? 5 : peak <= 60 ? 10 : peak <= 120 ? 20 : 50;
  const max = Math.max(step, Math.ceil(peak / step) * step);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  return { max, ticks };
}

/**
 * Weekly mileage across the season: planned vs actual.
 *
 * Columns are the actual miles; planned rides as a thin target marker on the
 * same scale (both are miles — never a second axis). Clicking a column jumps
 * the calendar to that week.
 */
export function SeasonChart({
  series,
  currentWeek,
  selectedWeek,
  onSelectWeek,
}: {
  series: WeekPoint[];
  currentWeek: IsoDate;
  selectedWeek: IsoDate;
  onSelectWeek: (week: IsoDate) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const peak = Math.max(
    0,
    ...series.map((w) => Math.max(w.plannedMiles, w.actualMiles)),
  );
  const { max, ticks } = axisScale(peak);

  const hasAnyData = series.some((w) => w.plannedMiles > 0 || w.actualMiles > 0);

  return (
    <Card
      title="Season mileage"
      action={
        <div className="flex items-center gap-3 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full bg-ink-secondary" aria-hidden />
            Planned
          </span>
        </div>
      }
    >
      {!hasAnyData ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Plan a week or drop a GPX file to start the season chart.
        </p>
      ) : (
        // pt-2 leaves room for the topmost tick label, which is centred on the
        // axis line and would otherwise be clipped by the card edge.
        <div className="flex gap-2 pt-2">
          {/* Y axis */}
          <div
            className="relative w-8 shrink-0"
            style={{ height: PLOT_HEIGHT }}
            aria-hidden
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-ink-muted"
                style={{ bottom: `${(t / max) * 100}%` }}
              >
                {Math.round(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="relative" style={{ height: PLOT_HEIGHT }}>
                {/* Gridlines — hairline, solid, recessive, behind the marks. */}
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute inset-x-0 h-px bg-border"
                    style={{ bottom: `${(t / max) * 100}%` }}
                    aria-hidden
                  />
                ))}

                <div className="absolute inset-0 flex items-end gap-[2px]">
                  {series.map((w) => {
                    const actualPct = (w.actualMiles / max) * 100;
                    const plannedPct = (w.plannedMiles / max) * 100;
                    const isCurrent = w.weekStart === currentWeek;
                    const isSelected = w.weekStart === selectedWeek;
                    const isHovered = hovered === w.weekStart;

                    return (
                      <button
                        key={w.weekStart}
                        type="button"
                        onClick={() => onSelectWeek(w.weekStart)}
                        onMouseEnter={() => setHovered(w.weekStart)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(w.weekStart)}
                        onBlur={() => setHovered(null)}
                        title={`Week of ${formatWeekRange(w.weekStart)}`}
                        aria-label={`Week of ${formatWeekRange(w.weekStart)}: ${w.actualMiles.toFixed(1)} miles actual, ${w.plannedMiles.toFixed(1)} planned`}
                        className={`group relative flex h-full flex-1 items-end justify-center rounded-t transition-colors ${
                          isSelected ? "bg-accent-soft/40" : "hover:bg-accent-soft/25"
                        }`}
                      >
                        {/* Actual — column, capped width, rounded cap only. */}
                        {w.actualMiles > 0 && (
                          <span
                            className={`w-full max-w-[24px] rounded-t ${
                              isHovered || isSelected ? "bg-accent-strong" : "bg-accent"
                            }`}
                            style={{ height: `${Math.max(1.5, actualPct)}%` }}
                          />
                        )}

                        {/* Planned — target marker on the same scale. */}
                        {w.plannedMiles > 0 && (
                          <span
                            className="absolute h-0.5 w-full max-w-[26px] rounded-full bg-ink-secondary"
                            style={{ bottom: `${plannedPct}%` }}
                            aria-hidden
                          />
                        )}

                        {isCurrent && (
                          <span
                            className="absolute inset-x-0 bottom-0 h-0.5 bg-today"
                            aria-hidden
                          />
                        )}

                        {isHovered && (
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-left text-[11px] leading-tight shadow-lg">
                            <span className="block font-semibold text-ink">
                              {formatWeekRange(w.weekStart)}
                            </span>
                            <span className="block tabular-nums text-ink-secondary">
                              {w.actualMiles.toFixed(1)} mi actual
                            </span>
                            <span className="block tabular-nums text-ink-muted">
                              {w.plannedMiles.toFixed(1)} mi planned
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* X axis — label sparingly so ticks stay readable. */}
              <div className="mt-1.5 flex gap-[2px]">
                {series.map((w, i) => {
                  const show = i === 0 || i === series.length - 1 || i % 3 === 0;
                  return (
                    <span
                      key={w.weekStart}
                      className={`flex-1 text-center text-[10px] tabular-nums ${
                        w.weekStart === currentWeek
                          ? "font-semibold text-today"
                          : "text-ink-muted"
                      }`}
                    >
                      {show ? formatWeekRange(w.weekStart).split(" – ")[0] : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
