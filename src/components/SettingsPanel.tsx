"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/client";
import type { SeasonConfig } from "@/lib/store";
import { Button, Spinner } from "./ui";

/**
 * Season settings as a compact dropdown. Collapsed it's just a trigger button —
 * it used to be a full card, which stretched to its grid neighbour's height and
 * left a large empty box.
 */
export function SettingsPanel({
  config,
  onSaved,
}: {
  config: SeasonConfig;
  onSaved: (config: SeasonConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-seed the form whenever the panel opens, so a cancelled edit doesn't
  // linger as stale values next time.
  useEffect(() => {
    if (open) {
      setForm(config);
      setError(null);
    }
  }, [open, config]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function set<K extends keyof SeasonConfig>(key: K, value: SeasonConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api<SeasonConfig>("/api/config", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      onSaved(saved);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          open
            ? "border-accent bg-surface text-ink"
            : "border-border bg-surface text-ink-muted hover:text-ink"
        }`}
      >
        <GearIcon />
        Season settings
        <ChevronIcon className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Season settings"
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-lg"
        >
          <div className="space-y-3">
            <Field label="Nationals date">
              <input
                type="date"
                value={form.nationalsDate}
                onChange={(e) => set("nationalsDate", e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Season start">
                <input
                  type="date"
                  value={form.seasonStartDate}
                  onChange={(e) => set("seasonStartDate", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Season end">
                <input
                  type="date"
                  value={form.seasonEndDate}
                  onChange={(e) => set("seasonEndDate", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm tabular-nums text-ink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${className}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
