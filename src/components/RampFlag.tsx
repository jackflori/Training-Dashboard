"use client";

import { useState } from "react";

import { ApiError, api } from "@/lib/client";
import { formatWeekRange } from "@/lib/dates";
import { RAMP_LIMIT_PCT, type RampRate, type RampRow } from "@/lib/domain/totals";
import { useCanEdit } from "./AuthGate";
import { Card, Spinner } from "./ui";

/** Common reasons a jump is expected. One click each — no typing required. */
const REASONS = ["Injury return", "Illness", "Intentional build"] as const;

/**
 * Week-over-week mileage ramp against the ~10% rule, plus the recent weeks it
 * was computed from — one number alone doesn't show whether the ramp is a blip
 * or a trend.
 *
 * A flagged jump can be dismissed when there's a known reason. The dismissal is
 * keyed to that specific week, so a later genuine spike still fires.
 *
 * Status never rides on color alone: each state ships an icon and a worded
 * label, which matters because the warning hue is deliberately sub-3:1 on the
 * light surface.
 */
export function RampFlag({
  ramp,
  rows,
  onChange,
}: {
  ramp: RampRate;
  rows: RampRow[];
  onChange: () => void | Promise<void>;
}) {
  const canEdit = useCanEdit();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recent = rows.slice(-4);

  async function dismiss(reason: string | null) {
    if (!ramp.currentWeek) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/ramp-ack", {
        method: "PUT",
        body: JSON.stringify({ isoWeekStart: ramp.currentWeek, reason }),
      });
      setPicking(false);
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not dismiss");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!ramp.currentWeek) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/ramp-ack?week=${ramp.currentWeek}`, { method: "DELETE" });
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not restore");
    } finally {
      setBusy(false);
    }
  }

  if (ramp.status === "insufficient") {
    return (
      <Card title="Week-over-week">
        <p className="text-sm text-ink-muted">
          Needs two completed weeks before it can compare.
        </p>
        {recent.length > 0 && <RecentList rows={recent} />}
      </Card>
    );
  }

  const high = ramp.status === "high";
  const acknowledged = ramp.status === "acknowledged";
  const returning = ramp.status === "returning";
  const zero = ramp.status === "zero";
  const pct = ramp.changePct ?? 0;
  const signed = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;

  const headlineTone = high
    ? "text-warn"
    : ramp.status === "ok"
      ? "text-good"
      : "text-ink";

  return (
    <Card title="Week-over-week">
      <div className="flex items-baseline gap-2">
        {returning ? (
          <>
            <span className={`text-3xl font-semibold ${headlineTone}`}>
              {ramp.currentMiles.toFixed(1)}
            </span>
            <span className="text-sm text-ink-muted">mi, first week back</span>
          </>
        ) : (
          <>
            <span className={`text-3xl font-semibold ${headlineTone}`}>{signed}</span>
            <span className="text-sm text-ink-muted">vs. previous week</span>
          </>
        )}
      </div>

      {returning && (
        <p className="mt-2 text-sm text-ink-secondary">
          Coming back from a week off — no percentage to compare against.
        </p>
      )}

      {high && (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-warn">
            <WarnIcon />
            Above the {RAMP_LIMIT_PCT}% guideline
          </div>

          {!canEdit ? null : picking ? (
            <div className="mt-2">
              <p className="text-xs text-ink-muted">Why was this expected?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => dismiss(r)}
                    disabled={busy}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-secondary transition hover:border-accent-mid hover:bg-accent-soft/40 hover:text-accent disabled:opacity-50"
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => dismiss(null)}
                  disabled={busy}
                  className="rounded-full border border-transparent px-2.5 py-1 text-xs text-ink-muted transition hover:text-ink disabled:opacity-50"
                >
                  No reason
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPicking(false)}
                disabled={busy}
                className="mt-1.5 text-xs text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              disabled={busy}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-secondary underline underline-offset-2 transition hover:text-ink"
            >
              {busy && <Spinner className="h-3 w-3" />}
              Dismiss this alert
            </button>
          )}
        </>
      )}

      {acknowledged && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-ink-secondary">
            <MutedIcon />
            Dismissed{ramp.reason ? ` · ${ramp.reason}` : ""}
          </div>
          {canEdit && (
          <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="mt-1 inline-flex items-center gap-1 text-xs text-ink-secondary underline underline-offset-2 transition hover:text-ink"
          >
            {busy && <Spinner className="h-3 w-3" />}
            Restore alert
          </button>
          )}
        </div>
      )}

      {ramp.status === "ok" && (
        <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-good">
          <CheckIcon />
          Within the {RAMP_LIMIT_PCT}% guideline
        </div>
      )}

      {/* A week off is reported, not judged — no green check, no warning. */}
      {zero && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-ink-secondary">
            <RestIcon />
            No mileage logged that week
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Down from {ramp.previousMiles.toFixed(1)} mi the week before.
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <RecentList rows={recent} />
    </Card>
  );
}

/**
 * The last few weeks. Zero weeks are shown rather than omitted — a week off is
 * part of the season's shape.
 */
function RecentList({ rows }: { rows: RampRow[] }) {
  return (
    <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
      {rows.map((row) => (
        <li
          key={row.weekStart}
          className={`flex items-baseline justify-between gap-2 text-xs ${
            row.isZero ? "opacity-70" : ""
          }`}
        >
          <span className="min-w-0 truncate text-ink-muted">
            {formatWeekRange(row.weekStart)}
            {row.inProgress && (
              <span className="ml-1 text-ink-muted/70">· in progress</span>
            )}
            {row.acknowledged && row.reason && (
              <span className="ml-1 text-ink-muted/70">· {row.reason}</span>
            )}
          </span>

          <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
            <span
              className={row.isZero ? "text-ink-muted" : "font-medium text-ink"}
            >
              {row.miles.toFixed(1)} mi
            </span>
            <span
              className={`w-14 text-right ${
                row.overLimit && !row.acknowledged
                  ? "font-medium text-warn"
                  : "text-ink-muted"
              }`}
            >
              {row.returning
                ? "back"
                : row.changePct === null
                  ? "—"
                  : `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(0)}%`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.5" />
    </svg>
  );
}

/** Pause bars — time off, stated neutrally rather than judged. */
function RestIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

/** Bell with a slash — "this one is muted", not "this one is fine". */
function MutedIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-9.3-5" />
      <path d="M6 9v5l-2 3h13" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
