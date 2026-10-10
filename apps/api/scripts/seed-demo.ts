// Demo data for the admin dashboard: ~60 bins around Delhi with six weeks of use, full/broken/dirty
// reports and fixes, missing reports and "bins near me" searches (including areas with no bin).
//
//   npm run seed:demo            add demo data (runs --reset first, so it can be re-run)
//   npm run seed:demo -- --reset remove demo data only
//
// Local development only: refuses to run with NODE_ENV=production. Photos are copied from an
// existing upload in .local-uploads (STORAGE_MODE=local); with S3 the demo photos won't load.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { binEvents, binInteractions, binIssues, bins, getDb, inArray, searchLogs, sql, users } from "@smartbin/db";

if (process.env.NODE_ENV === "production") throw new Error("seed-demo is for local development only");

const SEED_DOMAIN = "seed.smartbin.local";
// Seeded search logs carry this sub-millisecond mark, so --reset can find them.
// ponytail: about 1 in 1000 real logs share it by chance; fine for local demo data.
const SEARCH_MARK_US = 777;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = Date.now();

// Deterministic randomness, so every run makes the same demo
let state = 20261010;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const poisson = (mean: number) => {
  let k = 0;
  for (let p = Math.exp(-mean), s = p, u = rand(); u > s; k++) s += p *= mean / (k + 1);
  return k;
};
// Most reports and searches happen around meals and commutes
const BUSY_HOURS = [7, 8, 9, 9, 10, 10, 11, 12, 13, 13, 14, 16, 17, 18, 19, 19, 20, 20, 21, 22];
const atBusyHour = (day: number) => {
  const d = new Date(day);
  d.setHours(pick(BUSY_HOURS), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  return d.getTime();
};

const AREAS = [
  { name: "Connaught Place", lat: 28.6315, lng: 77.2167, bins: 10, busy: 2.5, fillHours: 10 },
  { name: "Chandni Chowk", lat: 28.6506, lng: 77.2303, bins: 8, busy: 2.2, fillHours: 7 },
  { name: "Karol Bagh", lat: 28.6519, lng: 77.1909, bins: 8, busy: 1.6, fillHours: 14 },
  { name: "Lajpat Nagar", lat: 28.5677, lng: 77.2433, bins: 8, busy: 1.4, fillHours: 16 },
  { name: "Hauz Khas", lat: 28.5494, lng: 77.2001, bins: 7, busy: 1.1, fillHours: 22 },
  { name: "Saket", lat: 28.5245, lng: 77.2066, bins: 7, busy: 1.0, fillHours: 26 },
  { name: "IIT Delhi", lat: 28.545, lng: 77.1926, bins: 6, busy: 0.7, fillHours: 40 },
  { name: "Rajouri Garden", lat: 28.6492, lng: 77.1222, bins: 6, busy: 0.9, fillHours: 30 },
];
// People search here but nobody has mapped a bin
const UNSERVED = [
  { lat: 28.6046, lng: 77.2947, perDay: 7 }, // Mayur Vihar
  { lat: 28.5823, lng: 77.05, perDay: 5 }, // Dwarka
  { lat: 28.7041, lng: 77.1025, perDay: 4 }, // Rohini
];
const SPOTS = ["Metro gate", "Bus stop", "Market entrance", "Park gate", "Temple road", "Food court", "Parking lot", "Main road", "School gate", "Hospital gate"];

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function inChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 1000) await insert(rows.slice(i, i + 1000));
}

async function reset() {
  const db = getDb();
  const seedUsers = await db.select({ id: users.id }).from(users).where(sql`${users.email} like ${"%@" + SEED_DOMAIN}`);
  const userIds = seedUsers.map((u) => u.id);
  if (userIds.length) {
    const seedBins = await db.select({ id: bins.id }).from(bins).where(inArray(bins.createdBy, userIds));
    const binIds = seedBins.map((b) => b.id);
    if (binIds.length) {
      await db.delete(binEvents).where(inArray(binEvents.binId, binIds));
      await db.delete(bins).where(inArray(bins.id, binIds)); // issues and interactions cascade
    }
    await db.delete(binEvents).where(inArray(binEvents.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await db.delete(searchLogs).where(sql`(extract(microseconds from ${searchLogs.createdAt})::int % 1000) = ${SEARCH_MARK_US}`);
  console.log(`Removed demo data (${userIds.length} demo users and their bins).`);
}

// A photo already uploaded locally, reused for every demo bin
function samplePhoto(): string | null {
  const root = path.resolve(".local-uploads");
  if (!existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (/\.(jpe?g|png|webp)$/i.test(name)) return full;
    }
  }
  return null;
}

async function seed() {
  const db = getDb();

  // People
  const people = await db
    .insert(users)
    .values(Array.from({ length: 30 }, (_, i) => {
      const email = `walker${String(i + 1).padStart(2, "0")}@${SEED_DOMAIN}`;
      return { email, cognitoSub: `dev:${email}`, createdAt: new Date(now - between(5, 60) * DAY) };
    }))
    .returning({ id: users.id });
  const [admin] = await db
    .insert(users)
    .values({ email: `cleaning-crew@${SEED_DOMAIN}`, cognitoSub: `dev:cleaning-crew@${SEED_DOMAIN}`, role: "ADMIN" })
    .returning({ id: users.id });
  const someone = () => pick(people).id;

  const photo = samplePhoto();
  if (!photo) console.warn("No photo found in .local-uploads; demo bins will have no picture. Add one bin in the app first.");

  type DemoBin = typeof bins.$inferInsert & { id: string; busy: number; fillHours: number; area: string };
  const demoBins: DemoBin[] = [];
  for (const area of AREAS) {
    for (let i = 0; i < area.bins; i++) {
      const at = { lat: area.lat + between(-0.004, 0.004), lng: area.lng + between(-0.004, 0.004) };
      if (demoBins.some((b) => metres(at, { lat: b.latitude, lng: b.longitude }) < 20)) continue;
      const createdBy = someone();
      const id = randomUUID();
      const imageKey = `dustbins/${createdBy}/${randomUUID()}.jpg`;
      if (photo) {
        const target = path.resolve(".local-uploads", imageKey);
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(photo, target);
      }
      demoBins.push({
        id,
        name: `${pick(SPOTS)}, ${area.name}`,
        imageKey,
        type: pick(["WET", "DRY", "BOTH", "BOTH"] as const),
        latitude: at.lat,
        longitude: at.lng,
        createdBy,
        createdAt: new Date(now - between(14, 45) * DAY),
        // Some bins are much busier than others in the same area
        busy: area.busy * between(0.3, 1.8),
        fillHours: area.fillHours * between(0.6, 1.5),
        area: area.name,
      });
    }
  }

  const events: (typeof binEvents.$inferInsert)[] = [];
  const issues: (typeof binIssues.$inferInsert)[] = [];
  const interactions: (typeof binInteractions.$inferInsert)[] = [];
  const missing = new Map<string, number>();

  for (const b of demoBins) {
    const born = b.createdAt!.getTime();
    events.push({ binId: b.id, userId: b.createdBy, type: "REGISTERED", latitude: b.latitude, longitude: b.longitude, createdAt: b.createdAt });

    // Opened, directions, arrived: every day since it was added
    for (let day = born; day < now + DAY; day += DAY) {
      const views = poisson(b.busy * 5);
      for (let v = 0; v < views; v++) {
        const t = atBusyHour(day);
        if (t > now - 20 * 60_000) continue; // nothing in the future (today stops at "now")
        const userId = someone();
        interactions.push({ binId: b.id, userId, type: "VIEW", createdAt: new Date(t) });
        if (rand() < 0.4) {
          interactions.push({ binId: b.id, userId, type: "DIRECTIONS", createdAt: new Date(t + 30_000) });
          if (rand() < 0.7) interactions.push({ binId: b.id, userId, type: "ARRIVED", createdAt: new Date(t + between(4, 15) * 60_000) });
        }
      }
    }

    // Fill up, get reported full, get emptied, repeat. Busy areas fill faster and wait longer for the crew.
    let emptied = born;
    for (;;) {
      let fullAt = atBusyHour(emptied + b.fillHours * between(0.6, 1.4) * HOUR);
      if (fullAt <= emptied) fullAt = emptied + between(1, 3) * HOUR; // the busy hour that day had passed
      if (fullAt > now) break;
      const reporters = 1 + poisson(b.busy * 0.6);
      const fixAt = fullAt + between(1, 4 + b.busy * 6) * HOUR;
      const stillOpen = fixAt > now;
      for (let r = 0; r < reporters; r++) {
        const at = new Date(Math.min(now - 1000, fullAt + r * between(5, 50) * 60_000));
        const userId = someone();
        issues.push({ binId: b.id, userId, type: "FULL", createdAt: at, resolvedAt: stillOpen ? null : new Date(fixAt), resolvedBy: stillOpen ? null : admin!.id });
        events.push({ binId: b.id, userId, type: "ISSUE_REPORT", latitude: b.latitude, longitude: b.longitude, meta: { issue: "FULL" }, createdAt: at });
      }
      if (stillOpen) break;
      events.push({ binId: b.id, userId: admin!.id, type: "ISSUE_RESOLVED", meta: { issues: ["FULL"], reports: reporters }, createdAt: new Date(fixAt) });
      emptied = fixAt;
    }

    // Occasional damage and mess
    for (const [type, chance, note] of [["BROKEN", 0.12, "Lid broken off"], ["DIRTY", 0.2, null], ["OTHER", 0.05, "Blocked by a parked cart"]] as const) {
      if (rand() > chance) continue;
      // Half of them recent, so some are still waiting for the crew
      const at = new Date(rand() < 0.5 ? between(now - 3 * DAY, now) : between(born, now));
      const fixAt = at.getTime() + between(6, 72) * HOUR;
      const open = fixAt > now;
      const userId = someone();
      issues.push({ binId: b.id, userId, type, note, createdAt: at, resolvedAt: open ? null : new Date(fixAt), resolvedBy: open ? null : admin!.id });
      events.push({ binId: b.id, userId, type: "ISSUE_REPORT", latitude: b.latitude, longitude: b.longitude, meta: { issue: type, ...(note && { note }) }, createdAt: at });
      if (!open) events.push({ binId: b.id, userId: admin!.id, type: "ISSUE_RESOLVED", meta: { issues: [type], reports: 1 }, createdAt: new Date(fixAt) });
    }

    // A few bins that may have gone missing
    if (rand() < 0.07) {
      const reports = 1 + Math.floor(rand() * 2);
      missing.set(b.id, reports);
      for (let r = 0; r < reports; r++) {
        events.push({ binId: b.id, userId: someone(), type: "MISSING_REPORT", latitude: b.latitude, longitude: b.longitude, meta: { reportNumber: r + 1 }, createdAt: new Date(now - between(1, 6) * DAY) });
      }
    }
  }

  // "Bins near me" searches: around mapped areas, and in places with no bin
  const searches: (typeof searchLogs.$inferInsert)[] = [];
  // JS dates stop at milliseconds, so the microsecond mark is added in SQL
  const at = (t: number) => sql`${new Date(Math.min(now - 1000, t)).toISOString()}::timestamptz + make_interval(secs => ${SEARCH_MARK_US / 1_000_000})`;
  for (let day = now - 45 * DAY; day < now + DAY; day += DAY) {
    for (const area of [...AREAS.map((a) => ({ ...a, perDay: a.busy * 18 })), ...UNSERVED]) {
      for (let n = poisson(area.perDay); n > 0; n--) {
        const t = atBusyHour(day);
        if (t > now) continue;
        const p = { lat: area.lat + between(-0.006, 0.006), lng: area.lng + between(-0.006, 0.006) };
        searches.push({
          latCell: Math.round(p.lat * 1000) / 1000,
          lngCell: Math.round(p.lng * 1000) / 1000,
          binsNearby: demoBins.filter((b) => metres(p, { lat: b.latitude, lng: b.longitude }) <= 500).length,
          createdAt: at(t) as unknown as Date, // drizzle takes SQL here; its insert type doesn't say so
        });
      }
    }
  }

  await db.insert(bins).values(demoBins.map(({ busy: _b, fillHours: _f, area: _a, ...b }) => ({ ...b, missingReports: missing.get(b.id) ?? 0 })));
  await inChunks(issues, (c) => db.insert(binIssues).values(c));
  await inChunks(events, (c) => db.insert(binEvents).values(c));
  await inChunks(interactions, (c) => db.insert(binInteractions).values(c));
  await inChunks(searches, (c) => db.insert(searchLogs).values(c));

  console.log(
    `Added ${demoBins.length} bins, ${issues.length} problem reports, ${interactions.length} opens/directions/arrivals and ${searches.length} searches.`
  );
}

async function main() {
  await reset();
  if (!process.argv.includes("--reset")) await seed();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
