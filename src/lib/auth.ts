import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Single-password edit gate.
 *
 * Reads are public — the dashboard is meant to be shareable. Writes require a
 * session cookie obtained by posting the password to /api/auth/login.
 *
 * This is deliberately not a user system: there is exactly one athlete, so
 * accounts, registration and password reset would all be ceremony. It exists
 * to stop a stranger with the URL editing the training plan.
 */

export const SESSION_COOKIE = "td_session";
const SESSION_DAYS = 30;

function secret(): string {
  // Falls back to the password so a deploy that sets only AUTH_PASSWORD still
  // produces valid, unforgeable sessions.
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || "";
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_PASSWORD);
}

function sign(expiresAt: number): string {
  return createHmac("sha256", secret()).update(String(expiresAt)).digest("hex");
}

/** Constant-time compare of two strings of arbitrary length. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export function issueToken(): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expiresAt = Date.now() + maxAge * 1000;
  return { value: `${expiresAt}.${sign(expiresAt)}`, maxAge };
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !secret()) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;

  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  return safeEqual(sig, sign(expiresAt));
}

/**
 * Whether the current request may write.
 *
 * When no password is configured this is permissive in development (so local
 * work needs no setup) but denies in production — a deploy that forgets
 * AUTH_PASSWORD ends up read-only rather than world-writable.
 */
export function canEdit(): boolean {
  if (!isAuthConfigured()) return process.env.NODE_ENV !== "production";
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

export class UnauthorizedError extends Error {
  readonly code = "unauthorized" as const;
  constructor() {
    super("Sign in to make changes.");
    this.name = "UnauthorizedError";
  }
}

/** Call at the top of every mutating route handler. */
export function requireEdit(): void {
  if (!canEdit()) throw new UnauthorizedError();
}

/** Suggest a strong password for the deploy docs. */
export function suggestPassword(): string {
  return randomBytes(12).toString("base64url");
}
