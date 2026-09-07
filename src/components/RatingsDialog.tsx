"use client";

import { useState } from "react";

import { ApiError, api } from "@/lib/client";
import type { IsoDate } from "@/lib/dates";
import type { WeeklyReflection } from "@/lib/store";
import { Button, Spinner } from "./ui";

const SCALE = [1, 2, 3, 4, 5] as const;

const FIELDS = [
  { key: "eating", label: "Eating", low: "poor", high: "dialed in" },
  { key: "sleep", label: "Sleep", low: "poor", high: "great" },
  { key: "schoolStress", label: "School stress", low: "low", high: "high" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/**
 * Collected on the way into the weekly summary. Stored raw and shown as-is —
 * no score is computed from these (see DECISIONS.md).
 */
export function RatingsDialog({
  weekStart,
  existing,
  onSaved,
  onCancel,
}: {
  weekStart: IsoDate;
  existing: WeeklyReflection | null;
  onSaved: (r: WeeklyReflection) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<FieldKey, number>>({
    eating: existing?.eating ?? 3,
    sleep: existing?.sleep ?? 3,
    schoolStress: existing?.schoolStress ?? 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api<WeeklyReflection>("/api/summary", {
        method: "PUT",
        body: JSON.stringify({ isoWeekStart: weekStart, ...values }),
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save ratings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">How was the week?</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Stored as-is next to your stats — nothing is calculated from these.
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink">{field.label}</span>
                <span className="text-[10px] text-ink-muted">
                  1 = {field.low} · 5 = {field.high}
                </span>
              </div>
              <div className="flex gap-1.5">
                {SCALE.map((n) => {
                  const active = values[field.key] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setValues((v) => ({ ...v, [field.key]: n }))
                      }
                      aria-pressed={active}
                      className={`h-9 flex-1 rounded-lg border text-sm font-medium transition ${
                        active
                          ? "border-accent bg-accent text-on-accent"
                          : "border-border bg-surface text-ink-secondary hover:border-accent-mid hover:bg-accent-soft/40 hover:text-accent"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving && <Spinner className="mr-2" />}
            See summary
          </Button>
        </footer>
      </div>
    </div>
  );
}
