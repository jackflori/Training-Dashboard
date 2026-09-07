import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { UnauthorizedError } from "@/lib/auth";
import { GpxParseError } from "@/lib/gpx/parse";
import { StoreError } from "@/lib/store";

/**
 * Wrap a route handler so thrown errors become consistent JSON:
 *   { error: { code, message } }
 * with a sensible status. Keeps every route body focused on the happy path.
 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse> | Promise<Response>,
) {
  return async (...args: Args): Promise<NextResponse | Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 401 },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Request failed validation.",
          issues: err.issues,
        },
      },
      { status: 400 },
    );
  }

  if (err instanceof GpxParseError) {
    return NextResponse.json(
      { error: { code: "bad_gpx", message: err.message } },
      { status: 400 },
    );
  }

  if (err instanceof StoreError) {
    return NextResponse.json(
      { error: { code: "store_error", message: err.message } },
      { status: err.status },
    );
  }

  console.error("Unhandled route error:", err);
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong." } },
    { status: 500 },
  );
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
