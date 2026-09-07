import { PrismaClient, type Prisma } from "@prisma/client";

import type { IsoDate } from "@/lib/dates";
import { defaultConfig } from "./defaults";
import { StoreError } from "./errors";
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

/** Single row id for the config table. */
const CONFIG_ID = "singleton";

/**
 * Cached on globalThis so Next.js dev hot-reload doesn't open a new connection
 * pool on every module reload.
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  const client = globalForPrisma.__prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = client;
  return client;
}

type UploadRow = Prisma.UploadedActivityGetPayload<object>;
type PlanRow = Prisma.PlanEntryGetPayload<object>;
type ReflectionRow = Prisma.WeeklyReflectionGetPayload<object>;
type RampAckRow = Prisma.RampAckGetPayload<object>;

/**
 * Postgres-backed Store. The domain types use ISO strings for instants while
 * Postgres uses timestamps, so every row is mapped at this boundary — nothing
 * outside this file sees a Date.
 */
function toUpload(row: UploadRow): UploadedActivity {
  return {
    id: row.id,
    fileName: row.fileName,
    trackName: row.trackName,
    isoWeekStart: row.isoWeekStart,
    startTime: row.startTime?.toISOString() ?? null,
    distanceMeters: row.distanceMeters,
    movingSeconds: row.movingSeconds,
    elevationGainMeters: row.elevationGainMeters,
    isWorkout: row.isWorkout,
    workoutMiles: row.workoutMiles,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

function toPlanEntry(row: PlanRow): PlanEntry {
  return {
    isoWeekStart: row.isoWeekStart,
    day: row.day,
    slot: row.slot === "PM" ? "PM" : "AM",
    off: row.off,
    miles: row.miles,
    note: row.note,
  };
}

function toReflection(row: ReflectionRow): WeeklyReflection {
  return {
    isoWeekStart: row.isoWeekStart,
    eating: row.eating,
    sleep: row.sleep,
    schoolStress: row.schoolStress,
    submittedAt: row.submittedAt.toISOString(),
  };
}

function toRampAck(row: RampAckRow): RampAck {
  return {
    isoWeekStart: row.isoWeekStart,
    reason: row.reason,
    acknowledgedAt: row.acknowledgedAt.toISOString(),
  };
}

export class PrismaStore implements Store {
  private readonly db: PrismaClient;

  constructor(client: PrismaClient = getPrisma()) {
    this.db = client;
  }

  // ---- uploads ----
  async listUploads(): Promise<UploadedActivity[]> {
    const rows = await this.db.uploadedActivity.findMany({
      orderBy: { uploadedAt: "desc" },
    });
    return rows.map(toUpload);
  }

  async listUploadsForWeek(isoWeekStart: IsoDate): Promise<UploadedActivity[]> {
    const rows = await this.db.uploadedActivity.findMany({
      where: { isoWeekStart },
      orderBy: { uploadedAt: "desc" },
    });
    return rows.map(toUpload);
  }

  async createUploads(
    inputs: UploadedActivityInput[],
  ): Promise<UploadedActivity[]> {
    if (inputs.length === 0) return [];
    // createMany returns only a count, and the caller needs the rows (the
    // review screen keys off their ids), so create them in one transaction.
    const rows = await this.db.$transaction(
      inputs.map((input) =>
        this.db.uploadedActivity.create({
          data: {
            fileName: input.fileName,
            trackName: input.trackName,
            isoWeekStart: input.isoWeekStart,
            startTime: input.startTime ? new Date(input.startTime) : null,
            distanceMeters: input.distanceMeters,
            movingSeconds: input.movingSeconds,
            elevationGainMeters: input.elevationGainMeters,
          },
        }),
      ),
    );
    return rows.map(toUpload);
  }

  async updateUpload(
    id: string,
    patch: UploadedActivityPatch,
  ): Promise<UploadedActivity> {
    // Clearing the workout flag clears its volume too.
    const data: Prisma.UploadedActivityUpdateInput = { ...patch };
    if (patch.isWorkout === false) data.workoutMiles = null;

    try {
      return toUpload(
        await this.db.uploadedActivity.update({ where: { id }, data }),
      );
    } catch {
      throw new StoreError(`Upload ${id} not found`, 404);
    }
  }

  async deleteUpload(id: string): Promise<void> {
    await this.db.uploadedActivity.deleteMany({ where: { id } });
  }

  // ---- plan ----
  async listPlanEntries(isoWeekStart: IsoDate): Promise<PlanEntry[]> {
    const rows = await this.db.planEntry.findMany({ where: { isoWeekStart } });
    return rows.map(toPlanEntry);
  }

  async listAllPlanEntries(): Promise<PlanEntry[]> {
    const rows = await this.db.planEntry.findMany();
    return rows.map(toPlanEntry);
  }

  async upsertPlanEntry(entry: PlanEntryInput): Promise<PlanEntry> {
    const key = {
      isoWeekStart_day_slot: {
        isoWeekStart: entry.isoWeekStart,
        day: entry.day,
        slot: entry.slot,
      },
    };

    // A slot with nothing set at all is stored as absence, not as a blank row.
    const isEmpty = !entry.off && entry.miles === null && !entry.note;
    if (isEmpty) {
      await this.db.planEntry.deleteMany({
        where: {
          isoWeekStart: entry.isoWeekStart,
          day: entry.day,
          slot: entry.slot,
        },
      });
      return entry;
    }

    const fields = { off: entry.off, miles: entry.miles, note: entry.note };
    return toPlanEntry(
      await this.db.planEntry.upsert({
        where: key,
        create: {
          isoWeekStart: entry.isoWeekStart,
          day: entry.day,
          slot: entry.slot,
          ...fields,
        },
        update: fields,
      }),
    );
  }

  // ---- reflections ----
  async getReflection(isoWeekStart: IsoDate): Promise<WeeklyReflection | null> {
    const row = await this.db.weeklyReflection.findUnique({
      where: { isoWeekStart },
    });
    return row ? toReflection(row) : null;
  }

  async setReflection(reflection: WeeklyReflection): Promise<WeeklyReflection> {
    const fields = {
      eating: reflection.eating,
      sleep: reflection.sleep,
      schoolStress: reflection.schoolStress,
      submittedAt: new Date(reflection.submittedAt),
    };
    return toReflection(
      await this.db.weeklyReflection.upsert({
        where: { isoWeekStart: reflection.isoWeekStart },
        create: { isoWeekStart: reflection.isoWeekStart, ...fields },
        update: fields,
      }),
    );
  }

  // ---- ramp acknowledgements ----
  async listRampAcks(): Promise<RampAck[]> {
    const rows = await this.db.rampAck.findMany();
    return rows.map(toRampAck);
  }

  async setRampAck(ack: RampAck): Promise<RampAck> {
    const fields = {
      reason: ack.reason,
      acknowledgedAt: new Date(ack.acknowledgedAt),
    };
    return toRampAck(
      await this.db.rampAck.upsert({
        where: { isoWeekStart: ack.isoWeekStart },
        create: { isoWeekStart: ack.isoWeekStart, ...fields },
        update: fields,
      }),
    );
  }

  async clearRampAck(isoWeekStart: IsoDate): Promise<void> {
    await this.db.rampAck.deleteMany({ where: { isoWeekStart } });
  }

  // ---- config ----
  async getConfig(): Promise<SeasonConfig> {
    const row = await this.db.seasonConfig.findUnique({
      where: { id: CONFIG_ID },
    });
    if (!row) return defaultConfig();
    return {
      nationalsDate: row.nationalsDate,
      seasonStartDate: row.seasonStartDate,
      seasonEndDate: row.seasonEndDate,
    };
  }

  async setConfig(patch: SeasonConfigPatch): Promise<SeasonConfig> {
    const merged = { ...defaultConfig(), ...patch };
    const row = await this.db.seasonConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, ...merged },
      update: patch,
    });
    return {
      nationalsDate: row.nationalsDate,
      seasonStartDate: row.seasonStartDate,
      seasonEndDate: row.seasonEndDate,
    };
  }
}
