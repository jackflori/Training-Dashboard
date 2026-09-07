"use client";

import { WEEKDAY_LABELS, formatDayLabel, type IsoDate } from "@/lib/dates";
import type { WeekView } from "@/lib/dashboard";
import type { PlanEntry, PlanSlot } from "@/lib/store";
import { PlanCell } from "./PlanCell";

const SLOTS: PlanSlot[] = ["AM", "PM"];

/**
 * The main calendar — plan only. Uploaded/actual data is deliberately absent
 * here; it lives on the weekly summary page (locked scope).
 *
 * Three day states are distinguished by fill, not just text: a day with planned
 * mileage carries an accent wash, a full rest day recedes to the muted surface,
 * and today is outlined in the reserved secondary hue so it never competes with
 * the accent that means "planned".
 */
export function WeekCalendar({
  week,
  today,
  loading,
  onPlanSaved,
}: {
  week: WeekView;
  today: IsoDate;
  loading: boolean;
  onPlanSaved: (entry: PlanEntry) => void;
}) {
  const planAt = (day: number, slot: PlanSlot) =>
    week.plan.find((e) => e.day === day && e.slot === slot);

  return (
    <div
      className={`overflow-x-auto transition-opacity ${
        loading ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="grid min-w-[700px] grid-cols-7 gap-2">
        {week.days.map((iso, day) => {
          const isToday = iso === today;
          const am = planAt(day, "AM");
          const pm = planAt(day, "PM");
          const fullRest = (am?.off ?? false) && (pm?.off ?? false);
          const dayMiles = [am, pm].reduce(
            (sum, e) => (e && !e.off ? sum + (e.miles ?? 0) : sum),
            0,
          );
          const planned = dayMiles > 0;

          return (
            <div
              key={iso}
              className={`flex flex-col overflow-hidden rounded-lg border transition-colors ${
                isToday
                  ? "border-today ring-1 ring-today/40"
                  : planned
                    ? "border-accent-mid/60"
                    : "border-border"
              } ${
                fullRest
                  ? "bg-surface-muted"
                  : planned
                    ? "bg-accent-soft/35"
                    : "bg-surface"
              }`}
            >
              <div
                className={`flex items-baseline justify-between px-2 py-1.5 text-xs font-semibold ${
                  isToday
                    ? "bg-today text-white"
                    : planned
                      ? "bg-accent-soft/70 text-accent-strong"
                      : "bg-surface-muted text-ink-muted"
                }`}
              >
                <span>{WEEKDAY_LABELS[day]}</span>
                <span className="font-normal opacity-80">
                  {formatDayLabel(iso).split(" ")[1]}
                </span>
              </div>

              <div className="divide-y divide-border/70">
                {SLOTS.map((slot) => (
                  <PlanCell
                    key={slot}
                    weekStart={week.weekStart}
                    day={day}
                    slot={slot}
                    entry={planAt(day, slot)}
                    onSaved={onPlanSaved}
                  />
                ))}
              </div>

              <div className="mt-auto px-2 pb-1.5 pt-1 text-center text-[10px] font-semibold uppercase tracking-wide">
                {fullRest ? (
                  <span className="text-ink-muted">Rest day</span>
                ) : planned ? (
                  <span className="text-accent-strong">
                    {dayMiles.toFixed(1)} mi
                  </span>
                ) : (
                  <span className="text-transparent">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
