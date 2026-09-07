"use client";

import { useState } from "react";

import type { UploadRejection } from "@/app/api/uploads/route";
import { ApiError, api } from "@/lib/client";
import { formatWeekRange } from "@/lib/dates";
import { metersToMiles } from "@/lib/domain/activity";
import { duration } from "@/lib/format";
import type { UploadedActivity } from "@/lib/store";
import { Button, Spinner } from "./ui";

/**
 * One review screen for a whole batch (locked scope: not a popup per file).
 * Each parsed file gets an "Is this a workout?" toggle; saying yes reveals a
 * volume field. Files are already persisted at this point — this screen just
 * annotates them, so closing it early loses nothing.
 */
export function ReviewScreen({
  uploads,
  rejected,
  onClose,
  onChanged,
}: {
  uploads: UploadedActivity[];
  rejected: UploadRejection[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState(uploads);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await api<UploadedActivity>(`/api/uploads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setBusyId(null);
    }
  }

  async function discard(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/uploads/${id}`, { method: "DELETE" });
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove file");
    } finally {
      setBusyId(null);
    }
  }

  async function done() {
    setClosing(true);
    await onChanged();
    setClosing(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-xl">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">
            Review {rows.length} file{rows.length === 1 ? "" : "s"}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Flag any workouts and enter the quality volume. Everything else is
            already counted.
          </p>
        </header>

        {error && (
          <p className="border-b border-border bg-danger/10 px-5 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const busy = busyId === row.id;
            return (
              <li key={row.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {row.trackName || row.fileName}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                      {metersToMiles(row.distanceMeters).toFixed(2)} mi ·{" "}
                      {duration(row.movingSeconds)} moving · week of{" "}
                      {formatWeekRange(row.isoWeekStart)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {busy && <Spinner className="h-3 w-3 text-ink-muted" />}
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
                      <input
                        type="checkbox"
                        checked={row.isWorkout}
                        disabled={busy}
                        onChange={(e) =>
                          patch(row.id, { isWorkout: e.target.checked })
                        }
                        className="accent-[rgb(var(--accent))]"
                      />
                      Workout
                    </label>
                    <button
                      type="button"
                      onClick={() => discard(row.id)}
                      disabled={busy}
                      className="text-xs text-ink-muted hover:text-danger"
                    >
                      Discard
                    </button>
                  </div>
                </div>

                {row.isWorkout && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-ink-muted">Workout volume</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      defaultValue={row.workoutMiles ?? ""}
                      disabled={busy}
                      onBlur={(e) =>
                        patch(row.id, {
                          workoutMiles:
                            e.target.value.trim() === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      placeholder="mi"
                      className="w-20 rounded border border-border bg-surface px-2 py-1 text-sm tabular-nums"
                    />
                    <span className="text-xs text-ink-muted">mi</span>
                  </div>
                )}
              </li>
            );
          })}

          {rejected.map((r) => (
            <li key={r.fileName} className="bg-danger/5 px-5 py-3">
              <p className="truncate text-sm font-medium text-danger">{r.fileName}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{r.reason}</p>
            </li>
          ))}
        </ul>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="primary" onClick={done} disabled={closing}>
            {closing && <Spinner className="mr-2" />}
            Done
          </Button>
        </footer>
      </div>
    </div>
  );
}
