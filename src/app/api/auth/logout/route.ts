import { cookies } from "next/headers";

import { handle, json } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — drop the session cookie. */
export const POST = handle(async () => {
  cookies().delete(SESSION_COOKIE);
  return json({ ok: true });
});
