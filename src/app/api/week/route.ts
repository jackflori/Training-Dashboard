import { handle, json } from "@/lib/api";
import { currentWeekStart } from "@/lib/dates";
import { getWeekView } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

/** GET /api/week?start=YYYY-MM-DD — plan, uploads, aggregate, reflection. */
export const GET = handle(async (request: Request) => {
  const start = new URL(request.url).searchParams.get("start") ?? currentWeekStart();
  return json(await getWeekView(start));
});
