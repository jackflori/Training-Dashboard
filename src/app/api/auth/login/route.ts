import { cookies } from "next/headers";
import { z } from "zod";

import { handle, json } from "@/lib/api";
import { SESSION_COOKIE, checkPassword, isAuthConfigured, issueToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

/** POST /api/auth/login — exchange the shared password for a session cookie. */
export const POST = handle(async (request: Request) => {
  if (!isAuthConfigured()) {
    return json(
      {
        error: {
          code: "auth_not_configured",
          message: "No password is set on this deployment.",
        },
      },
      { status: 503 },
    );
  }

  const { password } = bodySchema.parse(await request.json());
  if (!checkPassword(password)) {
    return json(
      { error: { code: "bad_password", message: "Incorrect password." } },
      { status: 401 },
    );
  }

  const { value, maxAge } = issueToken();
  cookies().set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return json({ ok: true });
});
