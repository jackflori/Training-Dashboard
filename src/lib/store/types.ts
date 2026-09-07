import type { IsoDate } from "@/lib/dates";

/**
 * Persistence contract. Phase 1 implementation is a JSON file (json-store.ts).
 * Phase 2 swaps in a Prisma/Postgres implementation of this same interface —
 * see prisma/schema.prisma. Nothing outside src/lib/store should care which.
 */

/**
 * One uploaded GPX file, reduced to its aggregate numbers.
 *
 * Deliberately NOT tied to a day or an AM/PM session — per the locked scope,
 * files roll up into a weekly total and nothing tries to match them to planned
 * sessions. `isoWeekStart` is the only bucketing key.
 */
export interface UploadedActivity {
  id: string;
  fileName: string;
  /** Track name from inside the GPX, if it had one. */
  trackName: string | null;
  /** Monday of the week this file counts toward. */
  isoWeekStart: IsoDate;
  /** Start of the track (ISO), or null if the file had no timestamps. */
  startTime: string | null;
  distanceMeters: number;
  /** Moving time — stopped segments excluded. See lib/gpx/parse.ts. */
  movingSeconds: number;
  elevationGainMeters: number;
  /** Flagged on the review screen after a batch drop. */
  isWorkout: boolean;
  /** Miles of quality volume within the session, entered when isWorkout. */
  workoutMiles: number | null;
  uploadedAt: string;
}

export interface UploadedActivityInput {
  fileName: string;
  trackName: string | null;
  isoWeekStart: IsoDate;
  startTime: string | null;
  distanceMeters: number;
  movingSeconds: number;
  elevationGainMeters: number;
}

export interface UploadedActivityPatch {
  isWorkout?: boolean;
  workoutMiles?: number | null;
  isoWeekStart?: IsoDate;
}

export type PlanSlot = "AM" | "PM";

/**
 * One planned session. The plan side carries mileage and a free-text note only
 * — workout volume is captured on the upload side, not planned in advance.
 */
export interface PlanEntry {
  isoWeekStart: IsoDate;
  /** 0 = Monday ... 6 = Sunday */
  day: number;
  slot: PlanSlot;
  /** Explicitly marked as no session. Both slots off = full rest day. */
  off: boolean;
  /** Planned mileage. null when off or not yet filled in. */
  miles: number | null;
  note: string | null;
}

export type PlanEntryInput = PlanEntry;

/**
 * A dismissed week-over-week ramp warning. Keyed to the later week of the
 * compared pair, so acknowledging one jump never silences a later one.
 */
export interface RampAck {
  isoWeekStart: IsoDate;
  /** Why the jump was expected, e.g. "Injury". Null = dismissed without one. */
  reason: string | null;
  acknowledgedAt: string;
}

/**
 * Subjective end-of-week ratings, 1-5. Stored raw and displayed as-is — no
 * score is derived from them (see DECISIONS.md).
 */
export interface WeeklyReflection {
  isoWeekStart: IsoDate;
  eating: number;
  sleep: number;
  schoolStress: number;
  submittedAt: string;
}

export interface SeasonConfig {
  nationalsDate: IsoDate;
  seasonStartDate: IsoDate;
  seasonEndDate: IsoDate;
}

export type SeasonConfigPatch = Partial<SeasonConfig>;

export interface Store {
  listUploads(): Promise<UploadedActivity[]>;
  listUploadsForWeek(isoWeekStart: IsoDate): Promise<UploadedActivity[]>;
  createUploads(inputs: UploadedActivityInput[]): Promise<UploadedActivity[]>;
  updateUpload(id: string, patch: UploadedActivityPatch): Promise<UploadedActivity>;
  deleteUpload(id: string): Promise<void>;

  listPlanEntries(isoWeekStart: IsoDate): Promise<PlanEntry[]>;
  /** Every plan entry across all weeks — powers the season chart. */
  listAllPlanEntries(): Promise<PlanEntry[]>;
  upsertPlanEntry(entry: PlanEntryInput): Promise<PlanEntry>;

  getReflection(isoWeekStart: IsoDate): Promise<WeeklyReflection | null>;
  setReflection(reflection: WeeklyReflection): Promise<WeeklyReflection>;

  listRampAcks(): Promise<RampAck[]>;
  setRampAck(ack: RampAck): Promise<RampAck>;
  clearRampAck(isoWeekStart: IsoDate): Promise<void>;

  getConfig(): Promise<SeasonConfig>;
  setConfig(patch: SeasonConfigPatch): Promise<SeasonConfig>;
}
