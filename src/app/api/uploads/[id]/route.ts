import { z } from "zod";

import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    isWorkout: z.boolean().optional(),
    workoutMiles: z.number().min(0).max(100).nullable().optional(),
    isoWeekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/uploads/:id — used by the review screen to flag workouts. */
export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const patch = patchSchema.parse(await request.json());
  return json(await store.updateUpload(id, patch));
});

/** DELETE /api/uploads/:id — drop a file uploaded by mistake. */
export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await store.deleteUpload(id);
  return json({ ok: true });
});
