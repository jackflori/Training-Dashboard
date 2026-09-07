import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { IsoDate } from "@/lib/dates";
import type {
  PlanEntry,
  PlanEntryInput,
  RampAck,
  SeasonConfig,
  SeasonConfigPatch,
  Store,
  UploadedActivity,
  UploadedActivityInput,
  UploadedActivityPatch,
  WeeklyReflection,
} from "./types";

interface Snapshot {
  uploads: UploadedActivity[];
  plan: PlanEntry[];
  reflections: WeeklyReflection[];
  rampAcks: RampAck[];
  config: SeasonConfig | null;
}

function emptySnapshot(): Snapshot {
  return { uploads: [], plan: [], reflections: [], rampAcks: [], config: null };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Read an ISO date from env, falling back if unset/malformed. */
function envDate(key: string, fallback: IsoDate): IsoDate {
  const v = process.env[key];
  return v && ISO_RE.test(v) ? v : fallback;
}

/**
 * Seeded the first time config is read. These are only defaults — the values
 * are editable in the UI (Settings) and persisted into the store thereafter.
 */
function defaultConfig(): SeasonConfig {
  const nationalsDate = envDate("NATIONALS_DATE", "2026-11-21");
  return {
    nationalsDate,
    seasonStartDate: envDate("SEASON_START_DATE", "2026-09-01"),
    seasonEndDate: envDate("SEASON_END_DATE", nationalsDate),
  };
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

/**
 * File-backed Store. Not built for concurrency at scale, but this is a
 * single-athlete app: an in-process promise chain serialises writes and each
 * write is an atomic temp-file rename, which is plenty.
 */
export class JsonStore implements Store {
  private readonly filePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dataDir?: string) {
    const dir = dataDir ?? process.env.DATA_DIR ?? "./data";
    const abs = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
    this.filePath = join(abs, "store.json");
  }

  private async read(): Promise<Snapshot> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return { ...emptySnapshot(), ...(JSON.parse(raw) as Partial<Snapshot>) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptySnapshot();
      throw err;
    }
  }

  private async write(snapshot: Snapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(tmp, this.filePath);
  }

  /** Serialise a read-modify-write against the file. */
  private mutate<T>(fn: (snap: Snapshot) => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const snap = await this.read();
      const result = await fn(snap);
      await this.write(snap);
      return result;
    });
    // Keep the chain alive even if this mutation rejects.
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async peek<T>(fn: (snap: Snapshot) => T): Promise<T> {
    return fn(await this.read());
  }

  // ---- uploads ----
  listUploads(): Promise<UploadedActivity[]> {
    return this.peek((s) => [...s.uploads].sort(byUploadedAtDesc));
  }

  listUploadsForWeek(isoWeekStart: IsoDate): Promise<UploadedActivity[]> {
    return this.peek((s) =>
      s.uploads.filter((u) => u.isoWeekStart === isoWeekStart).sort(byUploadedAtDesc),
    );
  }

  createUploads(inputs: UploadedActivityInput[]): Promise<UploadedActivity[]> {
    return this.mutate((s) => {
      const now = new Date().toISOString();
      const created = inputs.map<UploadedActivity>((input) => ({
        ...input,
        id: randomUUID(),
        isWorkout: false,
        workoutMiles: null,
        uploadedAt: now,
      }));
      s.uploads.push(...created);
      return created;
    });
  }

  updateUpload(id: string, patch: UploadedActivityPatch): Promise<UploadedActivity> {
    return this.mutate((s) => {
      const upload = s.uploads.find((u) => u.id === id);
      if (!upload) throw new StoreError(`Upload ${id} not found`, 404);
      Object.assign(upload, patch);
      // Clearing the workout flag clears its volume too.
      if (upload.isWorkout === false) upload.workoutMiles = null;
      return upload;
    });
  }

  deleteUpload(id: string): Promise<void> {
    return this.mutate((s) => {
      s.uploads = s.uploads.filter((u) => u.id !== id);
    });
  }

  // ---- plan ----
  listPlanEntries(isoWeekStart: IsoDate): Promise<PlanEntry[]> {
    return this.peek((s) => s.plan.filter((e) => e.isoWeekStart === isoWeekStart));
  }

  listAllPlanEntries(): Promise<PlanEntry[]> {
    return this.peek((s) => [...s.plan]);
  }

  upsertPlanEntry(entry: PlanEntryInput): Promise<PlanEntry> {
    return this.mutate((s) => {
      const idx = s.plan.findIndex(
        (e) =>
          e.isoWeekStart === entry.isoWeekStart &&
          e.day === entry.day &&
          e.slot === entry.slot,
      );
      // A slot with nothing set at all is stored as absence, not as a row.
      const isEmpty = !entry.off && entry.miles === null && !entry.note;
      if (idx >= 0) {
        if (isEmpty) s.plan.splice(idx, 1);
        else s.plan[idx] = entry;
      } else if (!isEmpty) {
        s.plan.push(entry);
      }
      return entry;
    });
  }

  // ---- reflections ----
  getReflection(isoWeekStart: IsoDate): Promise<WeeklyReflection | null> {
    return this.peek(
      (s) => s.reflections.find((r) => r.isoWeekStart === isoWeekStart) ?? null,
    );
  }

  setReflection(reflection: WeeklyReflection): Promise<WeeklyReflection> {
    return this.mutate((s) => {
      const idx = s.reflections.findIndex(
        (r) => r.isoWeekStart === reflection.isoWeekStart,
      );
      if (idx >= 0) s.reflections[idx] = reflection;
      else s.reflections.push(reflection);
      return reflection;
    });
  }

  // ---- ramp acknowledgements ----
  listRampAcks(): Promise<RampAck[]> {
    return this.peek((s) => [...s.rampAcks]);
  }

  setRampAck(ack: RampAck): Promise<RampAck> {
    return this.mutate((s) => {
      const idx = s.rampAcks.findIndex((a) => a.isoWeekStart === ack.isoWeekStart);
      if (idx >= 0) s.rampAcks[idx] = ack;
      else s.rampAcks.push(ack);
      return ack;
    });
  }

  clearRampAck(isoWeekStart: IsoDate): Promise<void> {
    return this.mutate((s) => {
      s.rampAcks = s.rampAcks.filter((a) => a.isoWeekStart !== isoWeekStart);
    });
  }

  // ---- config ----
  getConfig(): Promise<SeasonConfig> {
    return this.peek((s) => s.config ?? defaultConfig());
  }

  setConfig(patch: SeasonConfigPatch): Promise<SeasonConfig> {
    return this.mutate((s) => {
      s.config = { ...(s.config ?? defaultConfig()), ...patch };
      return s.config;
    });
  }
}

function byUploadedAtDesc(a: UploadedActivity, b: UploadedActivity): number {
  return b.uploadedAt.localeCompare(a.uploadedAt);
}
