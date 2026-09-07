"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/client";
import { useCanEdit } from "./AuthGate";
import type { IsoDate } from "@/lib/dates";
import type { PlanEntry, PlanSlot } from "@/lib/store";
import { Spinner } from "./ui";

/**
 * One AM/PM planning slot: an off toggle, a mileage field, and a "+" that
 * reveals a free-text workout note. Saves on blur / Enter so there's no
 * explicit save button to hunt for.
 */
export function PlanCell({
  weekStart,
  day,
  slot,
  entry,
  onSaved,
}: {
  weekStart: IsoDate;
  day: number;
  slot: PlanSlot;
  entry: PlanEntry | undefined;
  onSaved: (entry: PlanEntry) => void;
}) {
  const canEdit = useCanEdit();
  const [off, setOff] = useState(entry?.off ?? false);
  const [miles, setMiles] = useState(entry?.miles?.toString() ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(entry?.note));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed local state when the week changes underneath us.
  useEffect(() => {
    setOff(entry?.off ?? false);
    setMiles(entry?.miles?.toString() ?? "");
    setNote(entry?.note ?? "");
    setShowNote(Boolean(entry?.note));
  }, [entry, weekStart]);

  const noteRef = useRef<HTMLInputElement>(null);

  async function save(next: { off?: boolean; miles?: string; note?: string }) {
    const nextOff = next.off ?? off;
    const nextMiles = next.miles ?? miles;
    const nextNote = next.note ?? note;

    const parsedMiles = nextMiles.trim() === "" ? null : Number(nextMiles);
    if (parsedMiles !== null && !Number.isFinite(parsedMiles)) {
      setError("Miles must be a number");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await api<PlanEntry>("/api/plan", {
        method: "PUT",
        body: JSON.stringify({
          isoWeekStart: weekStart,
          day,
          slot,
          off: nextOff,
          miles: nextOff ? null : parsedMiles,
          note: nextNote.trim() || null,
        }),
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function toggleOff() {
    const nextOff = !off;
    setOff(nextOff);
    if (nextOff) setMiles("");
    void save({ off: nextOff, miles: nextOff ? "" : miles });
  }

  return (
    <div className="px-1.5 py-1">
      <div className="flex items-center gap-1.5">
        <span className="w-6 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {slot}
        </span>

        {off ? (
          <span className="flex-1 text-xs italic text-ink-muted">off</span>
        ) : (
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            onBlur={() => save({})}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            disabled={!canEdit}
            placeholder="—"
            aria-label={`${slot} planned miles`}
            className="w-full min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium tabular-nums text-ink placeholder:text-ink-muted/50 hover:border-border focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        )}

        {saving && <Spinner className="h-3 w-3 text-ink-muted" />}

        {canEdit && (
        <button
          type="button"
          onClick={toggleOff}
          title={off ? "Mark as a session" : "Mark as off"}
          aria-pressed={off}
          className={`rounded px-1 text-[10px] font-medium transition ${
            off
              ? "bg-ink-muted/20 text-ink"
              : "text-ink-muted/50 hover:bg-surface-muted hover:text-ink"
          }`}
        >
          off
        </button>
        )}

        {canEdit && !off && (
          <button
            type="button"
            onClick={() => {
              setShowNote((s) => !s);
              // Focus after the input has actually mounted.
              requestAnimationFrame(() => noteRef.current?.focus());
            }}
            title="Workout note"
            aria-label="Add a workout note"
            className="rounded px-1 text-xs text-ink-muted/60 transition hover:bg-accent/10 hover:text-accent"
          >
            {showNote ? "−" : "+"}
          </button>
        )}
      </div>

      {!off && showNote && (
        <input
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => save({})}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          disabled={!canEdit}
          placeholder="workout note"
          aria-label={`${slot} workout note`}
          className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-ink placeholder:text-ink-muted/50 focus:border-accent focus:outline-none"
        />
      )}

      {error && <p className="mt-0.5 text-[10px] text-danger">{error}</p>}
    </div>
  );
}
