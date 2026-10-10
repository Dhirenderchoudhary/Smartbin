import { getDb, sql, eq, and, isNull, type Transaction } from "@smartbin/db";
import { appSettings, bins, binEvents, binIssues, binInteractions, searchLogs, type BinIssueType, type BinInteractionType } from "@smartbin/db";
import { getSettings, SETTING_DEFINITIONS } from "../../common/settings.js";
import { ApiError } from "../../common/http/ApiError.js";
import { verifyDustbinImage } from "../../common/ai/vision.js";
import {
  deleteImageObject,
  getImageObject,
  getImageViewUrl,
  userImagePrefix,
} from "../../common/storage/s3.js";
import { consumeQuota } from "../user/quota.js";
import { logBinEvent } from "../../common/events.js";
import type { CreateBinInput } from "./schemas.js";

const DUPLICATE_RADIUS_M = 15;
const REPORT_MAX_DISTANCE_M = 20;
// Looser than missing reports: an overflowing bin is obvious from across the road
const ISSUE_MAX_DISTANCE_M = 50;
// ponytail: nearest 500 only; cluster on the server (or vector tiles) once areas get denser than that
const NEARBY_LIMIT = 500;

// Open = not resolved yet. Bins get emptied without anyone telling us, so FULL lapses after
// the admin setting fullIssueHours (read in SQL so every query that lists issues agrees on it).
const fullIssueHours = sql`coalesce(
  (select (${appSettings.value})::int from ${appSettings} where ${appSettings.key} = 'fullIssueHours'),
  ${SETTING_DEFINITIONS.fullIssueHours.default()})`;
export const openIssue = sql`${binIssues.resolvedAt} is null
  and (${binIssues.type} <> 'FULL' or ${binIssues.createdAt} > now() - make_interval(hours => ${fullIssueHours}))`;

export type BinIssueSummary = { type: BinIssueType; reports: number; lastReportedAt: string; note: string | null };

// Open issues of a bin, one entry per type with its latest note, most recent first. Defaults to the bin row of the outer query.
// (spelled out: inside the subquery drizzle would print bins.id as a bare "id", which is bin_issues.id)
export function issuesSql(binId: unknown = sql`"bins"."id"`) {
  return sql<BinIssueSummary[]>`coalesce((
    select json_agg(json_build_object('type', t.type, 'reports', t.reports, 'lastReportedAt', t.last, 'note', t.note) order by t.last desc)
    from (
      select ${binIssues.type} as type, count(*)::int as reports, max(${binIssues.createdAt}) as last,
        (array_agg(${binIssues.note} order by ${binIssues.createdAt} desc) filter (where ${binIssues.note} is not null))[1] as note
      from ${binIssues}
      where ${binIssues.binId} = ${binId} and ${openIssue}
      group by ${binIssues.type}
    ) t
  ), '[]'::json)`;
}

// Haversine distance in meters from (lat, lng) to each bin row
function distanceSql(lat: number, lng: number) {
  return sql`6371000 * acos(least(1.0,
    cos(radians(${lat})) * cos(radians(${bins.latitude})) * cos(radians(${bins.longitude}) - radians(${lng})) +
    sin(radians(${lat})) * sin(radians(${bins.latitude}))
  ))`;
}

export async function getNearbyBins(lat: number, lng: number, radiusMeters?: number) {
  const db = getDb();

  const distance = distanceSql(lat, lng);

  const baseCondition = eq(bins.status, "ACTIVE");
  const conditions = radiusMeters !== undefined
    ? and(baseCondition, sql`${distance} <= ${radiusMeters}`)
    : baseCondition;

  const query = db
    .select({
      id: bins.id,
      name: bins.name,
      imageKey: bins.imageKey,
      type: bins.type,
      latitude: bins.latitude,
      longitude: bins.longitude,
      status: bins.status,
      missingReports: bins.missingReports,
      createdAt: bins.createdAt,
      issues: issuesSql(),
      distance: distance.mapWith(Number)
    })
    .from(bins)
    .where(conditions)
    .orderBy(distance);

  // No radius: the 5 closest. With a radius: everything in it, up to NEARBY_LIMIT nearest
  const finalQuery: any = query.limit(radiusMeters === undefined ? 5 : NEARBY_LIMIT);

  const activeBins: Array<Awaited<typeof query>[number]> = await finalQuery;

  return Promise.all(
    activeBins.map(async ({ imageKey, ...bin }) => ({
      ...bin,
      imageUrl: await getImageViewUrl(imageKey),
    }))
  );
}

async function findBinWithin(executor: Transaction | ReturnType<typeof getDb>, lat: number, lng: number, meters: number) {
  const [existing] = await executor
    .select({ id: bins.id })
    .from(bins)
    .where(sql`${distanceSql(lat, lng)} <= ${meters}`)
    .limit(1);
  return existing;
}

function duplicateNearby(existingBinId: string): ApiError {
  return ApiError.conflict(
    `A dustbin already exists within ${DUPLICATE_RADIUS_M} meters of this location.`,
    "DUPLICATE_NEARBY",
    { existingBinId }
  );
}

export async function createBin(userId: string, data: CreateBinInput) {
  // 1. The image must be one this user uploaded
  if (!data.imageKey.startsWith(userImagePrefix(userId))) {
    throw ApiError.forbidden("This image key does not belong to you.", "INVALID_IMAGE_KEY");
  }

  // 2. Cheap duplicate check before paying for the AI call
  //    (the monthly quota was already checked by requireQuota on the route)
  const db = getDb();
  const nearby = await findBinWithin(db, data.latitude, data.longitude, DUPLICATE_RADIUS_M);
  if (nearby) {
    throw duplicateNearby(nearby.id);
  }

  // 3. Verify with AI model
  const image = await getImageObject(data.imageKey);
  const isDustbin = await verifyDustbinImage(image.bytes, image.contentType);
  if (!isDustbin) {
    await deleteImageObject(data.imageKey);
    throw ApiError.unprocessable(
      "Image rejected: The AI model could not clearly identify a dustbin in the image.",
      "NOT_A_BIN"
    );
  }

  // 4. Register the bin. The lock serializes registrations so two people
  //    registering the same spot at once can't both pass the duplicate check.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('bins:create'))`);

    const duplicate = await findBinWithin(tx, data.latitude, data.longitude, DUPLICATE_RADIUS_M);
    if (duplicate) {
      throw duplicateNearby(duplicate.id);
    }

    await consumeQuota(tx, userId, "registrations");

    const [newBin] = await tx
      .insert(bins)
      .values({
        name: data.name || "SmartBin",
        imageKey: data.imageKey,
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
        status: "ACTIVE",
        missingReports: 0,
        createdBy: userId,
      })
      .returning();

    await logBinEvent(tx, {
      binId: newBin!.id,
      userId,
      type: "REGISTERED",
      latitude: data.latitude,
      longitude: data.longitude,
    });

    return newBin!;
  });
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function reportMissingBin(userId: string, binId: string, userLat: number, userLng: number) {
  const db = getDb();

  // 1. Fetch the existing bin first to check location
  const [existingBin] = await db
    .select()
    .from(bins)
    .where(eq(bins.id, binId))
    .limit(1);

  if (!existingBin) {
    throw ApiError.notFound("Dustbin not found");
  }

  // 2. Enforce 20-meter GPS check
  const distance = getDistanceMeters(userLat, userLng, existingBin.latitude, existingBin.longitude);
  if (distance > REPORT_MAX_DISTANCE_M) {
    throw ApiError.forbidden(
      `You must be physically within ${REPORT_MAX_DISTANCE_M} meters of the dustbin to report it missing.`,
      "TOO_FAR"
    );
  }

  // 3. Count the report; at the threshold (admin-set) the bin is removed and must be registered again
  const { missingReportsThreshold: threshold } = await getSettings();
  const result = await db.transaction(async (tx) => {
    // One report per user per bin; an admin reset lets everyone report again.
    // The per-bin lock stops a double tap from passing the check twice.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"bins:report:" + binId}))`);
    const [previous] = await tx
      .select({ id: binEvents.id })
      .from(binEvents)
      .where(sql`${binEvents.binId} = ${binId} and ${binEvents.userId} = ${userId}
        and ${binEvents.type} = 'MISSING_REPORT'
        and ${binEvents.createdAt} > coalesce(
          (select max(created_at) from bin_events where bin_id = ${binId} and type = 'ADMIN_RESET_REPORTS'),
          '-infinity')`)
      .limit(1);
    if (previous) {
      throw ApiError.conflict("You have already reported this dustbin as missing.", "ALREADY_REPORTED");
    }

    await consumeQuota(tx, userId, "missingReports");

    const [updatedBin] = await tx
      .update(bins)
      .set({ missingReports: sql`${bins.missingReports} + 1` })
      .where(eq(bins.id, binId))
      .returning({ id: bins.id, missingReports: bins.missingReports, imageKey: bins.imageKey });

    // Removed by a concurrent report between the read above and this update
    if (!updatedBin) {
      throw ApiError.notFound("Dustbin not found");
    }

    // Reporter's position, so admins can see where reports came from
    await logBinEvent(tx, {
      binId,
      userId,
      type: "MISSING_REPORT",
      latitude: userLat,
      longitude: userLng,
      meta: { reportNumber: updatedBin.missingReports },
    });

    const removed = updatedBin.missingReports >= threshold;
    if (removed) {
      await tx.delete(bins).where(eq(bins.id, binId));
      await logBinEvent(tx, {
        binId,
        userId,
        type: "REMOVED",
        latitude: existingBin.latitude,
        longitude: existingBin.longitude,
        meta: {
          name: existingBin.name,
          type: existingBin.type,
          createdBy: existingBin.createdBy,
          registeredAt: existingBin.createdAt,
          missingReports: updatedBin.missingReports,
        },
      });
    }

    return { ...updatedBin, removed };
  });

  if (result.removed) {
    await deleteImageObject(result.imageKey);
  }

  return {
    id: result.id,
    missingReports: result.missingReports,
    threshold,
    removed: result.removed,
  };
}

async function binWithinReach(binId: string, userLat: number, userLng: number) {
  const [bin] = await getDb().select().from(bins).where(eq(bins.id, binId)).limit(1);
  if (!bin) {
    throw ApiError.notFound("Dustbin not found");
  }
  if (getDistanceMeters(userLat, userLng, bin.latitude, bin.longitude) > ISSUE_MAX_DISTANCE_M) {
    throw ApiError.forbidden(`You must be within ${ISSUE_MAX_DISTANCE_M} meters of the dustbin.`, "TOO_FAR");
  }
}

export async function openIssuesOf(executor: Transaction | ReturnType<typeof getDb>, binId: string) {
  const [row] = await executor.select({ issues: issuesSql(binId) }).from(bins).where(eq(bins.id, binId));
  return row?.issues ?? [];
}

export async function reportBinIssue(
  userId: string,
  binId: string,
  data: { type: BinIssueType; note?: string; lat: number; lng: number }
) {
  await binWithinReach(binId, data.lat, data.lng);

  // ponytail: no monthly quota; one open report per user, bin and type caps the spam
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"bins:issue:" + binId}))`);
    const [previous] = await tx
      .select({ id: binIssues.id })
      .from(binIssues)
      .where(and(eq(binIssues.binId, binId), eq(binIssues.userId, userId), eq(binIssues.type, data.type), openIssue))
      .limit(1);
    if (previous) {
      throw ApiError.conflict("You have already reported this problem with this dustbin.", "ALREADY_REPORTED");
    }

    await tx.insert(binIssues).values({ binId, userId, type: data.type, note: data.note || null });
    await logBinEvent(tx, {
      binId,
      userId,
      type: "ISSUE_REPORT",
      latitude: data.lat,
      longitude: data.lng,
      meta: { issue: data.type, ...(data.note && { note: data.note }) },
    });

    return { id: binId, issues: await openIssuesOf(tx, binId) };
  });
}

// Someone at the bin says it's been emptied or fixed (with their position), or an admin clears
// issues from the dashboard (no position, optionally every type at once).
export async function resolveBinIssues(
  userId: string,
  binId: string,
  data: { type?: BinIssueType; lat?: number; lng?: number },
  executor?: Transaction
) {
  if (data.lat !== undefined && data.lng !== undefined) {
    await binWithinReach(binId, data.lat, data.lng);
  }

  const run = async (tx: Transaction) => {
    const resolved = await tx
      .update(binIssues)
      .set({ resolvedAt: sql`now()`, resolvedBy: userId })
      .where(and(eq(binIssues.binId, binId), isNull(binIssues.resolvedAt), data.type ? eq(binIssues.type, data.type) : undefined))
      .returning({ type: binIssues.type });
    if (resolved.length) {
      await logBinEvent(tx, {
        binId,
        userId,
        type: "ISSUE_RESOLVED",
        latitude: data.lat ?? null,
        longitude: data.lng ?? null,
        meta: { issues: [...new Set(resolved.map((r) => r.type))], reports: resolved.length },
      });
    }
    return { id: binId, resolved: resolved.length, issues: await openIssuesOf(tx, binId) };
  };
  return executor ? run(executor) : getDb().transaction(run);
}

// Dedupe windows, so refreshing or tapping twice doesn't inflate the numbers
const INTERACTION_DEDUPE_MINUTES: Record<BinInteractionType, number> = { VIEW: 60, DIRECTIONS: 10, ARRIVED: 60 };

export async function recordInteraction(userId: string, binId: string, type: BinInteractionType) {
  const rows = await getDb().execute(sql`
    insert into ${binInteractions} (bin_id, user_id, type)
    select ${binId}, ${userId}, ${type}
    where exists (select 1 from ${bins} where ${bins.id} = ${binId})
      and not exists (
        select 1 from ${binInteractions}
        where bin_id = ${binId} and user_id = ${userId} and type = ${type}
          and created_at > now() - make_interval(mins => ${INTERACTION_DEDUPE_MINUTES[type]})
      )
    returning id`);
  return { recorded: rows.length > 0 };
}

// Within this distance a search counts as served by a bin
const SEARCH_SERVED_M = 500;

// Anonymous: no user, position rounded to 3 decimals (~100 m)
export async function logSearch(lat: number, lng: number, results: { distance: number }[]) {
  await getDb()
    .insert(searchLogs)
    .values({
      latCell: Math.round(lat * 1000) / 1000,
      lngCell: Math.round(lng * 1000) / 1000,
      binsNearby: results.filter((b) => b.distance <= SEARCH_SERVED_M).length,
    });
}
