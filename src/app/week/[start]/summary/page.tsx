import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthProvider } from "@/components/AuthGate";
import { WeeklySummary } from "@/components/WeeklySummary";
import { canEdit } from "@/lib/auth";
import { getWeekView } from "@/lib/dashboard";
import { isSummaryUnlocked, mondayOf } from "@/lib/dates";

export const dynamic = "force-dynamic";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function WeeklySummaryPage({
  params,
}: {
  params: Promise<{ start: string }>;
}) {
  const { start } = await params;
  if (!ISO_RE.test(start)) notFound();

  const weekStart = mondayOf(start);
  const week = await getWeekView(weekStart);

  // The gate is enforced on the server too, not just by hiding the link.
  if (!isSummaryUnlocked(weekStart)) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Summary not open yet</h1>
          <p className="mt-2 text-sm text-ink-muted">
            The weekly summary unlocks Sunday at 1:00 pm Eastern, once the week is
            done.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            ← Back to the calendar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AuthProvider canEdit={canEdit()}>
      <WeeklySummary week={week} />
    </AuthProvider>
  );
}
