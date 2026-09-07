import { XMLParser } from "fast-xml-parser";

/**
 * GPX parsing. A GPX file is XML containing one or more <trk> (tracks), each
 * with <trkseg> (segments), each with a list of <trkpt lat lon> points that may
 * carry <ele> (metres) and <time> (ISO 8601).
 *
 * We derive three numbers from that point stream: distance, moving time, and
 * elevation gain. Each needs a little care — see the constants below.
 */

export interface TrackPoint {
  lat: number;
  lon: number;
  /** Metres above sea level, if the device recorded it. */
  ele: number | null;
  /** Epoch milliseconds, if the device recorded it. */
  time: number | null;
}

export interface ParsedGpx {
  /** Name from <trk><name>, or <metadata><name>, if present. */
  name: string | null;
  /** Start time of the first timestamped point (ISO), or null. */
  startTime: string | null;
  pointCount: number;
  distanceMeters: number;
  movingSeconds: number;
  elevationGainMeters: number;
}

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxParseError";
  }
}

/**
 * Below this speed we treat the athlete as stopped (stoplight, water fountain,
 * tying a shoe). 0.5 m/s is ~32:00/mi — slower than any real running or even
 * brisk walking, so it only catches genuine stops, not a death-march hill.
 */
const MOVING_SPEED_THRESHOLD_MPS = 0.5;

/**
 * If two consecutive points are more than this far apart in time, the watch was
 * almost certainly paused or lost signal. Don't count the gap either way.
 */
const MAX_SAMPLE_GAP_SECONDS = 30;

/**
 * Barometric/GPS altitude jitters by a metre or two even standing still.
 * Only count a climb once it exceeds this, so noise doesn't accumulate into
 * hundreds of phantom feet over a long run.
 */
const ELEVATION_NOISE_THRESHOLD_METERS = 1.5;

const EARTH_RADIUS_METERS = 6_371_008.8;

/** Great-circle distance between two lat/lon points, in metres. */
export function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const lat1 = aLat * toRad;
  const lat2 = bLat * toRad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Always get an array back, whether the parser gave us one, many, or none. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

interface RawTrkpt {
  "@_lat"?: string | number;
  "@_lon"?: string | number;
  ele?: string | number;
  time?: string;
}

interface RawTrkseg {
  trkpt?: RawTrkpt | RawTrkpt[];
}

interface RawTrk {
  name?: unknown;
  trkseg?: RawTrkseg | RawTrkseg[];
}

interface RawGpx {
  gpx?: {
    trk?: RawTrk | RawTrk[];
    metadata?: { name?: unknown };
  };
}

/** Pull the flat list of trackpoints out of the parsed XML tree. */
export function extractPoints(xml: string): { points: TrackPoint[]; name: string | null } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Keep <time> as a string; we parse it ourselves.
    parseTagValue: false,
  });

  let doc: RawGpx;
  try {
    doc = parser.parse(xml) as RawGpx;
  } catch (err) {
    throw new GpxParseError(
      `Not valid XML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const gpx = doc?.gpx;
  if (!gpx) throw new GpxParseError("No <gpx> root element — is this a GPX file?");

  const tracks = toArray(gpx.trk);
  const trackName = tracks[0]?.name;
  const metadataName = gpx.metadata?.name;
  const name =
    (typeof trackName === "string" ? trackName : null) ??
    (typeof metadataName === "string" ? metadataName : null);

  const points: TrackPoint[] = [];
  for (const trk of tracks) {
    for (const seg of toArray(trk.trkseg)) {
      for (const pt of toArray(seg.trkpt)) {
        const lat = num(pt["@_lat"]);
        const lon = num(pt["@_lon"]);
        if (lat === null || lon === null) continue;

        const t = pt.time ? Date.parse(pt.time) : NaN;
        points.push({
          lat,
          lon,
          ele: num(pt.ele),
          time: Number.isFinite(t) ? t : null,
        });
      }
    }
  }

  return { points, name };
}

/**
 * Reduce a point stream to the three aggregate numbers we store.
 *
 * Distance is summed unconditionally (a stopped athlete contributes ~0 anyway).
 * Moving time only accrues on segments above the speed threshold. Elevation
 * gain uses a hysteresis filter: we track the last "confirmed" altitude and
 * only bank a climb once the rise clears the noise threshold.
 */
export function summarizePoints(points: TrackPoint[]): {
  distanceMeters: number;
  movingSeconds: number;
  elevationGainMeters: number;
  startTime: string | null;
} {
  let distanceMeters = 0;
  let movingSeconds = 0;
  let elevationGainMeters = 0;

  let referenceEle: number | null = null;
  let startTime: string | null = null;

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;

    if (startTime === null && p.time !== null) {
      startTime = new Date(p.time).toISOString();
    }

    // Elevation: hysteresis against the last confirmed altitude.
    if (p.ele !== null) {
      if (referenceEle === null) {
        referenceEle = p.ele;
      } else {
        const delta = p.ele - referenceEle;
        if (Math.abs(delta) >= ELEVATION_NOISE_THRESHOLD_METERS) {
          if (delta > 0) elevationGainMeters += delta;
          referenceEle = p.ele;
        }
      }
    }

    if (i === 0) continue;
    const prev = points[i - 1]!;

    const segmentMeters = haversineMeters(prev.lat, prev.lon, p.lat, p.lon);
    distanceMeters += segmentMeters;

    if (prev.time === null || p.time === null) continue;
    const dt = (p.time - prev.time) / 1000;
    // Skip non-positive steps (duplicate timestamps) and pause-sized gaps.
    if (dt <= 0 || dt > MAX_SAMPLE_GAP_SECONDS) continue;

    if (segmentMeters / dt >= MOVING_SPEED_THRESHOLD_MPS) {
      movingSeconds += dt;
    }
  }

  return {
    distanceMeters,
    movingSeconds: Math.round(movingSeconds),
    elevationGainMeters,
    startTime,
  };
}

/** Parse a whole GPX document into the summary we persist. */
export function parseGpx(xml: string): ParsedGpx {
  const { points, name } = extractPoints(xml);
  if (points.length < 2) {
    throw new GpxParseError(
      "Fewer than two trackpoints — the file has no usable route data.",
    );
  }

  const summary = summarizePoints(points);
  return { name, pointCount: points.length, ...summary };
}
