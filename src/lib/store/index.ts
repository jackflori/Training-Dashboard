import { JsonStore } from "./json-store";
import type { Store } from "./types";

/**
 * The single Store instance for the app. Swap this line for a Prisma-backed
 * implementation in Phase 2 and nothing else needs to change.
 *
 * Cached on globalThis so Next.js dev hot-reload doesn't spawn a new file
 * handle / write queue on every module reload.
 */
const globalForStore = globalThis as unknown as { __store?: Store };

export const store: Store = globalForStore.__store ?? new JsonStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.__store = store;
}

export * from "./types";
export { StoreError } from "./json-store";
