"use client";

/** Error thrown by `api()` carrying the server's error code + status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * fetch wrapper for calling our own /api routes from the browser. Parses the
 * `{ error: { code, message } }` convention into a typed ApiError.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const body = (data ?? {}) as ErrorBody;
    throw new ApiError(
      res.status,
      body.error?.code ?? "unknown",
      body.error?.message ?? `Request failed (${res.status})`,
    );
  }

  return data as T;
}
