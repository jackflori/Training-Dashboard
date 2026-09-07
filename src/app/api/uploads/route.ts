import { handle, json } from "@/lib/api";
import { requireEdit } from "@/lib/auth";
import { currentWeekStart, mondayOf, toIsoDate } from "@/lib/dates";
import { GpxParseError, parseGpx } from "@/lib/gpx/parse";
import { store, type UploadedActivityInput } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Guard against someone dropping a video file into the zone. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface UploadRejection {
  fileName: string;
  reason: string;
}

export interface UploadResponse {
  created: Awaited<ReturnType<typeof store.createUploads>>;
  rejected: UploadRejection[];
}

/**
 * POST /api/uploads — multipart batch of GPX files.
 *
 * Each file is parsed to its aggregate numbers and bucketed into a week. Files
 * are never matched to a day or an AM/PM session (locked scope): the week is
 * taken from the track's own start timestamp, falling back to the week the user
 * was viewing for files with no time data.
 *
 * One bad file doesn't fail the batch — it comes back in `rejected` so the
 * review screen can show what didn't make it.
 */
export const POST = handle(async (request: Request) => {
  requireEdit();
  const form = await request.formData();
  const fallbackWeek = mondayOf(
    (form.get("fallbackWeek") as string | null) ?? currentWeekStart(),
  );

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return json(
      { error: { code: "invalid_request", message: "No files were uploaded." } },
      { status: 400 },
    );
  }

  const inputs: UploadedActivityInput[] = [];
  const rejected: UploadRejection[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ fileName: file.name, reason: "File is larger than 20 MB." });
      continue;
    }

    try {
      const parsed = parseGpx(await file.text());
      inputs.push({
        fileName: file.name,
        trackName: parsed.name,
        isoWeekStart: parsed.startTime
          ? mondayOf(toIsoDate(new Date(parsed.startTime)))
          : fallbackWeek,
        startTime: parsed.startTime,
        distanceMeters: parsed.distanceMeters,
        movingSeconds: parsed.movingSeconds,
        elevationGainMeters: parsed.elevationGainMeters,
      });
    } catch (err) {
      rejected.push({
        fileName: file.name,
        reason:
          err instanceof GpxParseError ? err.message : "Could not read this file.",
      });
    }
  }

  const created = inputs.length > 0 ? await store.createUploads(inputs) : [];
  return json<UploadResponse>({ created, rejected }, { status: created.length ? 201 : 400 });
});

/** GET /api/uploads — every uploaded file, newest first. */
export const GET = handle(async () => json(await store.listUploads()));
