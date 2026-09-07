"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { UploadRejection, UploadResponse } from "@/app/api/uploads/route";
import { ApiError, api } from "@/lib/client";
import type { DashboardData, WeekView } from "@/lib/dashboard";
import { isSummaryUnlocked, type IsoDate } from "@/lib/dates";
import type { PlanEntry, UploadedActivity } from "@/lib/store";
import { DropZone } from "./DropZone";
import { RampFlag } from "./RampFlag";
import { ReviewScreen } from "./ReviewScreen";
import { SeasonChart } from "./SeasonChart";
import { SeasonSummary } from "./SeasonSummary";
import { SettingsPanel } from "./SettingsPanel";
import { WeekCalendar } from "./WeekCalendar";
import { WeekNav } from "./WeekNav";
import { BoltIcon, Card, Spinner } from "./ui";

interface Batch {
  created: UploadedActivity[];
  rejected: UploadRejection[];
}

export function Dashboard({
  initial,
  initialWeek,
}: {
  initial: DashboardData;
  initialWeek: WeekView;
}) {
  const [data, setData] = useState(initial);
  const [week, setWeek] = useState(initialWeek);
  const [weekStart, setWeekStart] = useState<IsoDate>(initialWeek.weekStart);
  const [weekLoading, setWeekLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadWeek = useCallback(async (start: IsoDate) => {
    setWeekLoading(true);
    try {
      setWeek(await api<WeekView>(`/api/week?start=${start}`));
    } finally {
      setWeekLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const [dash, wk] = await Promise.all([
      api<DashboardData>("/api/dashboard"),
      api<WeekView>(`/api/week?start=${weekStart}`),
    ]);
    setData(dash);
    setWeek(wk);
  }, [weekStart]);

  function selectWeek(start: IsoDate) {
    if (start === weekStart) return;
    setWeekStart(start);
    void loadWeek(start);
  }

  const handleFiles = useCallback(
    async (files: File[]) => {
      const gpx = files.filter((f) => f.name.toLowerCase().endsWith(".gpx"));
      if (gpx.length === 0) {
        setUploadError("Only .gpx files are supported.");
        return;
      }

      setUploading(true);
      setUploadError(null);
      try {
        const form = new FormData();
        for (const f of gpx) form.append("files", f);
        // Files without timestamps fall back to the week you're looking at.
        form.append("fallbackWeek", weekStart);

        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const body = (await res.json()) as UploadResponse & {
          error?: { message?: string };
        };
        if (!res.ok && !body.created?.length) {
          throw new Error(body.error?.message ?? "Upload failed.");
        }

        setBatch({ created: body.created ?? [], rejected: body.rejected ?? [] });
        await refreshAll();
      } catch (err) {
        setUploadError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Upload failed.",
        );
      } finally {
        setUploading(false);
      }
    },
    [weekStart, refreshAll],
  );

  function onPlanSaved(entry: PlanEntry) {
    const rest = week.plan.filter(
      (e) => !(e.day === entry.day && e.slot === entry.slot),
    );
    const isEmpty = !entry.off && entry.miles === null && !entry.note;
    const plan = isEmpty ? rest : [...rest, entry];
    const plannedMiles = plan.reduce((s, e) => (e.off ? s : s + (e.miles ?? 0)), 0);

    setWeek((w) => ({
      ...w,
      plan,
      plannedMiles,
      plannedSessions: plan.filter((e) => !e.off && (e.miles ?? 0) > 0).length,
    }));

    // Keep the season chart's planned marker in step with the edit, so it
    // doesn't sit stale until the next full refresh.
    setData((d) => ({
      ...d,
      series: d.series.map((pt) =>
        pt.weekStart === entry.isoWeekStart ? { ...pt, plannedMiles } : pt,
      ),
    }));
  }

  const summaryOpen = isSummaryUnlocked(weekStart);

  return (
    <>
      <DropZone onFiles={handleFiles} disabled={uploading || batch !== null} />

      {batch && (
        <ReviewScreen
          uploads={batch.created}
          rejected={batch.rejected}
          onClose={() => setBatch(null)}
          onChanged={refreshAll}
        />
      )}

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-on-accent"
              aria-hidden
            >
              <BoltIcon />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                Training Dashboard
              </h1>
              <p className="text-sm text-ink-muted">
                Drop GPX files anywhere on this page to log them.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {uploading && (
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <Spinner /> Parsing files…
              </span>
            )}
            <SettingsPanel
              config={data.config}
              onSaved={() => void refreshAll()}
            />
          </div>
        </header>

        {uploadError && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            {uploadError}
          </p>
        )}

        <SeasonSummary season={data.season} />

        <Card
          title="Weekly plan"
          action={
            <div className="w-72 max-w-full">
              <WeekNav
                weekStart={weekStart}
                weeks={data.weeks}
                currentWeek={data.currentWeek}
                onSelect={selectWeek}
              />
            </div>
          }
        >
          <div className="space-y-3">
            <WeekCalendar
              week={week}
              today={data.today}
              loading={weekLoading}
              onPlanSaved={onPlanSaved}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="text-ink-secondary">
                Planned{" "}
                <span className="font-semibold tabular-nums text-accent-strong">
                  {week.plannedMiles.toFixed(1)} mi
                </span>{" "}
                · {week.plannedSessions} session
                {week.plannedSessions === 1 ? "" : "s"}
              </span>

              {summaryOpen && (
                <Link
                  href={`/week/${weekStart}/summary`}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition hover:bg-accent-strong"
                >
                  Weekly summary →
                </Link>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <SeasonChart
            series={data.series}
            currentWeek={data.currentWeek}
            selectedWeek={weekStart}
            onSelectWeek={selectWeek}
          />
          <RampFlag
            ramp={data.ramp}
            rows={data.rampRows}
            onChange={refreshAll}
          />
        </div>
      </main>
    </>
  );
}
