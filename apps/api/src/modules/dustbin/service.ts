import { getDb, sql, eq, and } from "@smartbin/db";
import { bins } from "@smartbin/db";

const K_MISSING_REPORTS_THRESHOLD = 3;

export async function getNearbyBins(lat: number, lng: number, radiusMeters?: number) {
  const db = getDb();
  
  const distanceSql = sql`6371000 * acos(least(1.0, 
    cos(radians(${lat})) * cos(radians(${bins.latitude})) * cos(radians(${bins.longitude}) - radians(${lng})) +
    sin(radians(${lat})) * sin(radians(${bins.latitude}))
  ))`;

  const baseCondition = eq(bins.status, "ACTIVE");
  const conditions = radiusMeters !== undefined 
    ? and(baseCondition, sql`${distanceSql} <= ${radiusMeters}`)
    : baseCondition;

  const query = db
    .select({
      id: bins.id,
      name: bins.name,
      imageUrl: bins.imageUrl,
      type: bins.type,
      latitude: bins.latitude,
      longitude: bins.longitude,
      status: bins.status,
      missingReports: bins.missingReports,
      fillPercent: bins.fillPercent,
      createdAt: bins.createdAt,
      distance: distanceSql.mapWith(Number)
    })
    .from(bins)
    .where(conditions)
    .orderBy(distanceSql);

  let finalQuery: any = query;
  if (radiusMeters === undefined) {
    finalQuery = query.limit(5); // If no radius specified, return 5 closest
  }

  const activeBins = await finalQuery;
  return activeBins;
}

import { verifyDustbinImage } from "../../common/ai/bedrock.js";

export async function createBin(data: { name?: string, imageUrl: string, type: "WET" | "DRY" | "BOTH", latitude: number, longitude: number }) {
  // 1. Verify with AI model first
  const isDustbin = await verifyDustbinImage(data.imageUrl);
  if (!isDustbin) {
    throw new Error("Image rejected: The AI model could not clearly identify a dustbin in the image.");
  }

  const db = getDb();

  // 2. Proximity check (15 meters) using Haversine formula
  const distanceSql = sql`6371000 * acos(least(1.0, 
    cos(radians(${data.latitude})) * cos(radians(${bins.latitude})) * cos(radians(${bins.longitude}) - radians(${data.longitude})) +
    sin(radians(${data.latitude})) * sin(radians(${bins.latitude}))
  ))`;

  const existingNearby = await db
    .select()
    .from(bins)
    .where(sql`${distanceSql} <= 15`)
    .limit(1);

  if (existingNearby.length > 0) {
    throw new Error("A dustbin already exists within 15 meters of this location.");
  }

  // 3. Register the bin
  const [newBin] = await db
    .insert(bins)
    .values({
      name: data.name || "SmartBin",
      imageUrl: data.imageUrl,
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      status: "ACTIVE",
      missingReports: 0,
    })
    .returning();

  return newBin;
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

export async function reportMissingBin(binId: string, userLat: number, userLng: number) {
  const db = getDb();
  
  // 1. Fetch the existing bin first to check location
  const [existingBin] = await db
    .select()
    .from(bins)
    .where(eq(bins.id, binId))
    .limit(1);

  if (!existingBin) {
    throw new Error("Dustbin not found");
  }

  // 2. Enforce 20-meter GPS check
  const distance = getDistanceMeters(userLat, userLng, existingBin.latitude, existingBin.longitude);
  if (distance > 20) {
    throw new Error("GPS Validation Failed: You must be physically within 20 meters of the dustbin to report it missing.");
  }

  // 3. Increment missingReports by 1
  const [updatedBin] = await db
    .update(bins)
    .set({
      missingReports: sql`${bins.missingReports} + 1`
    })
    .where(eq(bins.id, binId))
    .returning();

  // 4. If the threshold is reached, transition status to MISSING
  if (updatedBin.missingReports >= K_MISSING_REPORTS_THRESHOLD && updatedBin.status === "ACTIVE") {
    const [missingBin] = await db
      .update(bins)
      .set({ status: "MISSING" })
      .where(eq(bins.id, binId))
      .returning();
    
    return { ...missingBin, statusChanged: true };
  }

  return { ...updatedBin, statusChanged: false };
}
