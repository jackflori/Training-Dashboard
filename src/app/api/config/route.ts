import { z } from "zod";

export const dynamic = "force-dynamic";

import { handle, json } from "@/lib/api";
import { requireEdit } from "@/lib/auth";
import { store } from "@/lib/store";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z
  .object({
    nationalsDate: iso.optional(),
    seasonStartDate: iso.optional(),
    seasonEndDate: iso.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

/** GET /api/config */
export const GET = handle(async () => json(await store.getConfig()));

/** PUT /api/config — partial update of season settings. */
export const PUT = handle(async (request: Request) => {
  requireEdit();
  const patch = patchSchema.parse(await request.json());
  return json(await store.setConfig(patch));
});
