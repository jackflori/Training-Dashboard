import { z } from "zod";

import { handle, json } from "@/lib/api";
import { requireEdit } from "@/lib/auth";
import { mondayOf } from "@/lib/dates";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const putSchema = z.object({
  isoWeekStart: weekSchema,
  /** Optional context, e.g. "Injury". Null = dismissed without a reason. */
  reason: z.string().max(80).nullable().optional(),
});

/** PUT /api/ramp-ack — dismiss the ramp warning for one week. */
export const PUT = handle(async (request: Request) => {
  requireEdit();
  const { isoWeekStart, reason } = putSchema.parse(await request.json());
  return json(
    await store.setRampAck({
      isoWeekStart: mondayOf(isoWeekStart),
      reason: reason?.trim() || null,
      acknowledgedAt: new Date().toISOString(),
    }),
  );
});

/** DELETE /api/ramp-ack?week=YYYY-MM-DD — restore the warning. */
export const DELETE = handle(async (request: Request) => {
  requireEdit();
  const week = weekSchema.parse(new URL(request.url).searchParams.get("week"));
  await store.clearRampAck(mondayOf(week));
  return json({ ok: true });
});
