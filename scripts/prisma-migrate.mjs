import { spawnSync } from "node:child_process";

/**
 * Applies pending Prisma migrations, but only when a database is actually
 * configured.
 *
 * Runs as the first half of `npm run build`. On Vercel, DATABASE_URL is set, so
 * the schema is migrated before the app that depends on it goes live — without
 * this, a deploy carrying a schema change builds green and then fails at
 * runtime against columns that don't exist yet.
 *
 * Locally there's usually no DATABASE_URL in the environment (the app falls
 * back to the file store), so this no-ops rather than failing the build.
 */
if (!process.env.DATABASE_URL) {
  console.log("[migrate] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

console.log("[migrate] applying migrations…");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

// Fail the build on a bad migration: shipping code against an unmigrated
// database is worse than not shipping. Vercel keeps the previous deploy live.
process.exit(result.status ?? 1);
