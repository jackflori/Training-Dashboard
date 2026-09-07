import { z } from "zod";

import { handle, json } from "@/lib/api";
import { isSummaryUnlocked, mondayOf } from "@/lib/dates";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const rating = z.number().int().min(1).max(5);

const bodySchema = z.object({
  isoWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eating: rating,
  sleep: rating,
  schoolStress: rating,
});

/**
 * PUT /api/summary — save the week's subjective ratings.
 *
 * Ratings are stored raw and never combined into a score (see DECISIONS.md).
 * The unlock rule is enforced here, not just in the UI, so the gate can't be
 * bypassed by hitting the endpoint directly.
 */
export const PUT = handle(async (request: Request) => {
  const parsed = bodySchema.parse(await request.json());
  const isoWeekStart = mondayOf(parsed.isoWeekStart);

  if (!isSummaryUnlocked(isoWeekStart)) {
    return json(
      {
        error: {
          code: "summary_locked",
          message: "The weekly summary opens Sunday at 1pm Eastern.",
        },
      },
      { status: 403 },
    );
  }

  return json(
    await store.setReflection({
      ...parsed,
      isoWeekStart,
      submittedAt: new Date().toISOString(),
    }),
  );
});
