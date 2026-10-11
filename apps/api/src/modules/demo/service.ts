import {
  getDb,
  bins,
  binEvents,
  binInteractions,
  binIssues,
  users,
  eq,
  and,
  count,
  sql,
  type Transaction,
} from "@smartbin/db";
import { config } from "../../common/config/config.js";
import { demoPhotoKey, storeImageObject } from "../../common/storage/s3.js";
import { loadCases, readCaseImage } from "../evals/dataset.js";
import { distanceSql } from "../dustbin/service.js";

// DEMO_MODE: when someone opens the map where there are few bins, create a dozen labelled demo bins
// around that spot, with a believable history, so the map and the admin dashboard have something to show.
// They are ordinary rows flagged is_demo and created by the demo user below, so
// `npm run seed:demo -- --reset` removes them again. Real registrations ignore them.

const DEMO_EMAIL = "demo-bins@seed.smartbin.local";
const NEARBY_M = 2500; // the web app asks for 2 km; leave some margin
const FEW_BINS = 6; // fewer than this nearby (real or demo) and the area is topped up with demo bins
const BINS_PER_AREA = 12;
const SPREAD_M = 900; // bins land within this distance of the spot
const MIN_APART_M = 30;
const MAX_DEMO_BINS = 6000; // global cap, so panning around can't grow the table without limit
const DAY = 86_400_000;
const HOUR = 3_600_000;

// India (with its islands). Outside it nothing is created.
const INDIA = { latMin: 6, latMax: 37.5, lngMin: 68, lngMax: 97.5 };

const SPOTS = ["Metro gate", "Bus stop", "Market entrance", "Park gate", "Temple road", "Food court", "Parking lot", "Main road", "School gate", "Hospital gate", "Railway station", "College gate"];
const rand = Math.random;
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// A random point within `meters` of the centre, spread evenly over the disc
function around(lat: number, lng: number, meters: number) {
  const r = meters * Math.sqrt(rand());
  const theta = rand() * 2 * Math.PI;
  return { lat: lat + (r * Math.cos(theta)) / 110540, lng: lng + (r * Math.sin(theta)) / (111320 * Math.cos((lat * Math.PI) / 180)) };
}

// The few shared demo photos, written once per process. They come from the AI evaluation set.
let photoCount: Promise<number> | undefined;
function ensurePhotos(): Promise<number> {
  photoCount ??= (async () => {
    const clear = loadCases().filter((c) => c.expect === "bin" && !c.hard);
    await Promise.all(clear.map((c, i) => storeImageObject(demoPhotoKey(i + 1), readCaseImage(c), "image/jpeg")));
    return clear.length;
  })().catch((err) => {
    photoCount = undefined; // try again next time
    throw err;
  });
  return photoCount;
}

// Active bins within `meters`, stopping at `limit` (we only need to know if there are enough)
async function binsWithin(executor: Transaction | ReturnType<typeof getDb>, lat: number, lng: number, meters: number, limit: number) {
  return executor
    .select({ lat: bins.latitude, lng: bins.longitude })
    .from(bins)
    .where(and(eq(bins.status, "ACTIVE"), sql`${distanceSql(lat, lng)} <= ${meters}`))
    .limit(limit);
}

async function demoUserId(tx: Transaction): Promise<string> {
  await tx.insert(users).values({ email: DEMO_EMAIL, cognitoSub: `dev:${DEMO_EMAIL}` }).onConflictDoNothing({ target: users.cognitoSub });
  const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.cognitoSub, `dev:${DEMO_EMAIL}`));
  return row!.id;
}

// Returns true if demo bins were created around (lat, lng)
export async function ensureDemoBinsAround(lat: number, lng: number): Promise<boolean> {
  if (!config.DEMO_MODE) return false;
  if (lat < INDIA.latMin || lat > INDIA.latMax || lng < INDIA.lngMin || lng > INDIA.lngMax) return false;

  const db = getDb();
  if ((await binsWithin(db, lat, lng, NEARBY_M, FEW_BINS)).length >= FEW_BINS) return false; // the common case: one cheap query

  const photos = await ensurePhotos();

  return db.transaction(async (tx) => {
    // One area at a time, and check again once we hold the lock (another request may have just made it)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('demo:area'))`);
    const existing = await binsWithin(tx, lat, lng, NEARBY_M, 200);
    if (existing.length >= FEW_BINS) return false;
    const [{ total }] = await tx.select({ total: count() }).from(bins).where(eq(bins.isDemo, true)) as [{ total: number }];
    if (total >= MAX_DEMO_BINS) return false;

    const creator = await demoUserId(tx);
    const now = Date.now();

    // Spots at least MIN_APART_M from each other and from any bin already there
    const spots: { lat: number; lng: number }[] = [];
    for (let attempt = 0; attempt < 300 && spots.length < BINS_PER_AREA; attempt++) {
      const p = around(lat, lng, SPREAD_M);
      if (spots.every((s) => metres(s, p) >= MIN_APART_M) && existing.every((e) => metres(e, p) >= MIN_APART_M)) spots.push(p);
    }

    const rows = spots.map((p, i) => ({
      id: crypto.randomUUID(),
      name: `Demo · ${pick(SPOTS)}`,
      imageKey: demoPhotoKey((i % photos) + 1),
      type: pick(["WET", "DRY", "BOTH", "BOTH"] as const),
      latitude: p.lat,
      longitude: p.lng,
      createdBy: creator,
      isDemo: true,
      createdAt: new Date(now - between(10, 40) * DAY),
    }));
    await tx.insert(bins).values(rows);

    const events: (typeof binEvents.$inferInsert)[] = [];
    const issues: (typeof binIssues.$inferInsert)[] = [];
    const interactions: (typeof binInteractions.$inferInsert)[] = [];

    for (const b of rows) {
      events.push({ binId: b.id, userId: creator, type: "REGISTERED", latitude: b.latitude, longitude: b.longitude, createdAt: b.createdAt });

      // Opens, directions and arrivals over the past weeks; busier bins get more
      const busy = between(0.4, 2);
      for (let n = Math.round(between(15, 50) * busy); n > 0; n--) {
        const at = now - between(0, Math.min(30, (now - b.createdAt.getTime()) / DAY)) * DAY;
        interactions.push({ binId: b.id, userId: creator, type: "VIEW", createdAt: new Date(at) });
        if (rand() < 0.4) {
          interactions.push({ binId: b.id, userId: creator, type: "DIRECTIONS", createdAt: new Date(at + 30_000) });
          if (rand() < 0.7) interactions.push({ binId: b.id, userId: creator, type: "ARRIVED", createdAt: new Date(at + between(4, 15) * 60_000) });
        }
      }

      // Some bins are full right now, some were full and got emptied, a few are broken or dirty
      const roll = rand();
      if (roll < 0.3) {
        const at = new Date(now - between(1, 14) * HOUR);
        issues.push({ binId: b.id, userId: creator, type: "FULL", createdAt: at });
        events.push({ binId: b.id, userId: creator, type: "ISSUE_REPORT", latitude: b.latitude, longitude: b.longitude, meta: { issue: "FULL" }, createdAt: at });
      } else if (roll < 0.6) {
        const at = now - between(1, 20) * DAY;
        const fixed = new Date(at + between(1, 8) * HOUR);
        issues.push({ binId: b.id, userId: creator, type: "FULL", createdAt: new Date(at), resolvedAt: fixed, resolvedBy: creator });
        events.push({ binId: b.id, userId: creator, type: "ISSUE_REPORT", latitude: b.latitude, longitude: b.longitude, meta: { issue: "FULL" }, createdAt: new Date(at) });
        events.push({ binId: b.id, userId: creator, type: "ISSUE_RESOLVED", meta: { issues: ["FULL"], reports: 1 }, createdAt: fixed });
      }
      if (rand() < 0.15) {
        const type = pick(["BROKEN", "DIRTY"] as const);
        const at = new Date(now - between(2, 48) * HOUR);
        issues.push({ binId: b.id, userId: creator, type, note: type === "BROKEN" ? "Lid broken off" : null, createdAt: at });
        events.push({ binId: b.id, userId: creator, type: "ISSUE_REPORT", latitude: b.latitude, longitude: b.longitude, meta: { issue: type }, createdAt: at });
      }
    }

    if (issues.length) await tx.insert(binIssues).values(issues);
    await tx.insert(binEvents).values(events);
    for (let i = 0; i < interactions.length; i += 1000) await tx.insert(binInteractions).values(interactions.slice(i, i + 1000));
    return true;
  });
}
