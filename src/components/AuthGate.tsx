"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { ApiError, api } from "@/lib/client";
import { Button, Spinner } from "./ui";

const CanEditContext = createContext(false);

/** True when this visitor may make changes. Read by every editable control. */
export function useCanEdit(): boolean {
  return useContext(CanEditContext);
}

export function AuthProvider({
  canEdit,
  children,
}: {
  canEdit: boolean;
  children: ReactNode;
}) {
  return (
    <CanEditContext.Provider value={canEdit}>{children}</CanEditContext.Provider>
  );
}

/**
 * Sign in / sign out control. Reads are public, so an unauthenticated visitor
 * sees the whole dashboard — this only unlocks editing.
 */
export function SignInButton({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      // Full reload so every server component re-renders with the new cookie.
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  if (canEdit) {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="text-xs text-ink-muted underline underline-offset-2 transition hover:text-ink"
      >
        Sign out
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:border-accent-mid hover:text-accent"
      >
        <LockIcon />
        Sign in to edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-ink">Sign in to edit</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Viewing is open to anyone. Changes need the password.
            </p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />

            {error && <p className="mt-2 text-xs text-danger">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !password.trim()}
              >
                {busy && <Spinner className="mr-2" />}
                Sign in
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function LockIcon() {
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
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
