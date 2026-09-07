import { JsonStore } from "./json-store";
import type { Store } from "./types";

/**
 * The single Store instance for the app.
 *
 * Backend is chosen by whether DATABASE_URL is set: Postgres in production (and
 * locally once you point at a database), the file-backed store otherwise. That
 * keeps `npm run dev` working with no database while production always has one
 * — Vercel's filesystem is read-only, so the file store cannot work there.
 *
 * The Prisma module is required lazily so the client is never loaded (or its
 * generated types demanded) in a file-store-only environment.
 */
const globalForStore = globalThis as unknown as { __store?: Store };

function createStore(): Store {
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaStore } = require("./prisma-store") as typeof import("./prisma-store");
    return new PrismaStore();
  }
  return new JsonStore();
}

export const store: Store = globalForStore.__store ?? createStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.__store = store;
}

export * from "./types";
export { StoreError } from "./errors";
