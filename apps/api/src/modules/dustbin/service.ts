import { getDb, sql, eq, and, type Transaction } from "@smartbin/db";
import { bins } from "@smartbin/db";
import { config } from "../../common/config/config.js";
import { ApiError } from "../../common/http/ApiError.js";
import { verifyDustbinImage } from "../../common/ai/vision.js";
import {
  deleteImageObject,
  getImageObject,
  getImageViewUrl,
  userImagePrefix,
} from "../../common/storage/s3.js";
import { consumeQuota, getUsage, quotaExceeded } from "../user/quota.js";
import { logBinEvent } from "../../common/events.js";
import type { CreateBinInput } from "./schemas.js";

const DUPLICATE_RADIUS_M = 15;
const REPORT_MAX_DISTANCE_M = 20;

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
      fillPercent: bins.fillPercent,
      createdAt: bins.createdAt,
      distance: distance.mapWith(Number)
    })
    .from(bins)
    .where(conditions)
    .orderBy(distance);

  let finalQuery: any = query;
  if (radiusMeters === undefined) {
    finalQuery = query.limit(5); // If no radius specified, return 5 closest
  }

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

  // 2. Cheap checks before paying for the AI call
  const usage = await getUsage(userId);
  if (usage.registrations >= config.QUOTA_LIMIT_REGISTRATIONS) {
    throw quotaExceeded("registrations");
  }

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

    await consumeQuota(tx, userId, "registrations", config.QUOTA_LIMIT_REGISTRATIONS);

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

  // 3. Count the report; at the threshold the bin is removed and must be registered again
  const result = await db.transaction(async (tx) => {
    await consumeQuota(tx, userId, "missingReports", config.QUOTA_LIMIT_MISSING_REPORTS);

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

    const removed = updatedBin.missingReports >= config.MISSING_REPORTS_THRESHOLD;
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
    threshold: config.MISSING_REPORTS_THRESHOLD,
    removed: result.removed,
  };
}
