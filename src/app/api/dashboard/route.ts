import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { getDashboardData } from "@/lib/dashboard";

/** GET /api/dashboard — everything the shell needs except per-week data. */
export const GET = handle(async () => json(await getDashboardData()));
