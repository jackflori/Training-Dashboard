import { z } from "zod";

import { handle, json } from "@/lib/api";
import { requireEdit } from "@/lib/auth";
import { mondayOf } from "@/lib/dates";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  isoWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.number().int().min(0).max(6),
  slot: z.enum(["AM", "PM"]),
  off: z.boolean(),
  miles: z.number().min(0).max(100).nullable(),
  note: z.string().max(500).nullable(),
});

/**
 * PUT /api/plan — upsert a single plan cell. An off slot carries no mileage,
 * and a slot with nothing set at all is removed rather than stored blank.
 */
export const PUT = handle(async (request: Request) => {
  requireEdit();
  const parsed = bodySchema.parse(await request.json());
  const entry = await store.upsertPlanEntry({
    ...parsed,
    isoWeekStart: mondayOf(parsed.isoWeekStart),
    miles: parsed.off ? null : parsed.miles,
    note: parsed.note?.trim() || null,
  });
  return json(entry);
});
