"use client";

import Link from "next/link";
import { useState } from "react";

import type { WeekView } from "@/lib/dashboard";
import { formatWeekRange } from "@/lib/dates";
import { metersToMiles } from "@/lib/domain/activity";
import { duration, feet } from "@/lib/format";
import type { WeeklyReflection } from "@/lib/store";
import { useCanEdit } from "./AuthGate";
import { RatingsDialog } from "./RatingsDialog";
import {
  BoltIcon,
  Card,
  ClockIcon,
  MountainIcon,
  RouteIcon,
  StatTile,
} from "./ui";

const RATING_FIELDS = [
  { key: "eating", label: "Eating" },
  { key: "sleep", label: "Sleep" },
  { key: "schoolStress", label: "School stress" },
] as const;

/**
 * The week's numbers. This is the only place uploaded/actual data is shown —
 * the main calendar stays plan-only.
 */
export function WeeklySummary({ week }: { week: WeekView }) {
  const canEdit = useCanEdit();
  const [reflection, setReflection] = useState<WeeklyReflection | null>(
    week.reflection,
  );
  // Ask for ratings on arrival if they haven't been given for this week yet —
  // but never prompt a read-only visitor for something they can't save.
  const [asking, setAsking] = useState(canEdit && week.reflection === null);

  const { aggregate } = week;
  const adherence =
    week.plannedMiles > 0 ? (aggregate.miles / week.plannedMiles) * 100 : null;

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      {asking && (
        <RatingsDialog
          weekStart={week.weekStart}
          existing={reflection}
          onSaved={(r) => {
            setReflection(r);
            setAsking(false);
          }}
          onCancel={() => setAsking(false)}
        />
      )}

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">
            Week of {formatWeekRange(week.weekStart)}
          </h1>
          <p className="text-sm text-ink-muted">
            {aggregate.fileCount} file{aggregate.fileCount === 1 ? "" : "s"} uploaded
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back to the calendar
        </Link>
      </header>

      <Card title="Totals">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Mileage"
            value={aggregate.miles.toFixed(1)}
            sub="miles"
            icon={<RouteIcon />}
            emphasis
          />
          <StatTile
            label="Time"
            value={duration(aggregate.movingSeconds)}
            sub="moving time"
            icon={<ClockIcon />}
          />
          <StatTile
            label="Avg pace"
            value={aggregate.averagePace ?? "—"}
            sub="per mile"
            icon={<BoltIcon />}
          />
          <StatTile
            label="Elevation"
            value={feet(aggregate.elevationGainFeet)}
            sub="gain"
            icon={<MountainIcon />}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Workout volume">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-ink">
              {aggregate.workoutMiles.toFixed(1)}
            </span>
            <span className="text-sm text-ink-muted">mi</span>
            {aggregate.workoutSharePct !== null && (
              <span className="ml-auto text-sm tabular-nums text-ink-muted">
                {aggregate.workoutSharePct.toFixed(0)}% of weekly mileage
              </span>
            )}
          </div>
          {aggregate.workoutSharePct !== null && (
            // Meter: unfilled track is a lighter step of the fill's own ramp,
            // so the whole bar reads as one measure rather than a gray gutter.
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent-soft">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${Math.max(2, Math.min(100, aggregate.workoutSharePct))}%`,
                }}
              />
            </div>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Planned {week.plannedMiles.toFixed(1)} mi across {week.plannedSessions}{" "}
            session{week.plannedSessions === 1 ? "" : "s"}
            {adherence !== null && ` · ${adherence.toFixed(0)}% of plan`}
          </p>
        </Card>

        <Card
          title="How the week felt"
          action={
            canEdit ? (
              <button
                type="button"
                onClick={() => setAsking(true)}
                className="text-xs font-medium text-accent hover:underline"
              >
                {reflection ? "Edit" : "Add"}
              </button>
            ) : null
          }
        >
          {reflection ? (
            <div className="space-y-2">
              {/* Fixed label column so the three meters align vertically. */}
              {RATING_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="grid grid-cols-[7rem_1fr_1.25rem] items-center gap-3"
                >
                  <span className="text-sm text-ink-secondary">{f.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-2 flex-1 rounded-full ${
                          n <= reflection[f.key] ? "bg-accent" : "bg-accent-soft"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-right text-sm font-medium tabular-nums text-ink">
                    {reflection[f.key]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No ratings for this week yet.</p>
          )}
        </Card>
      </div>

      <Card title="Files this week">
        {week.uploads.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing uploaded for this week.</p>
        ) : (
          <ul className="divide-y divide-border">
            {week.uploads.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-ink">
                  {u.trackName || u.fileName}
                  {u.isWorkout && (
                    <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent">
                      workout{u.workoutMiles ? ` ${u.workoutMiles} mi` : ""}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {metersToMiles(u.distanceMeters).toFixed(2)} mi ·{" "}
                  {duration(u.movingSeconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
