import {
  getDb,
  bins,
  users,
  binEvents,
  eq,
  and,
  sql,
  desc,
  asc,
  gt,
  ilike,
  count,
  getTableColumns,
} from "@smartbin/db";
import { ApiError } from "../../common/http/ApiError.js";
import { deleteImageObject, getImageViewUrl } from "../../common/storage/s3.js";
import { logBinEvent } from "../../common/events.js";
import type { BinPatchBody, BinsListQuery, EventsQuery } from "./schemas.js";

// "Today" and daily buckets follow Indian time, not UTC
const TZ = "Asia/Kolkata";
const todayStart = sql`(date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ})`;

function paged<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function getStats() {
  const db = getDb();

  const [binTotals, eventTotals, userTotals] = await Promise.all([
    db
      .select({
        active: count(),
        wet: sql<number>`count(*) filter (where ${bins.type} = 'WET')`.mapWith(Number),
        dry: sql<number>`count(*) filter (where ${bins.type} = 'DRY')`.mapWith(Number),
        both: sql<number>`count(*) filter (where ${bins.type} = 'BOTH')`.mapWith(Number),
        atRisk: sql<number>`count(*) filter (where ${bins.missingReports} > 0)`.mapWith(Number),
      })
      .from(bins),

    db
      .select({
        newToday: sql<number>`count(*) filter (where ${binEvents.type} = 'REGISTERED' and ${binEvents.createdAt} >= ${todayStart})`.mapWith(Number),
        new7: sql<number>`count(*) filter (where ${binEvents.type} = 'REGISTERED' and ${binEvents.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        new30: sql<number>`count(*) filter (where ${binEvents.type} = 'REGISTERED' and ${binEvents.createdAt} >= now() - interval '30 days')`.mapWith(Number),
        reportsToday: sql<number>`count(*) filter (where ${binEvents.type} = 'MISSING_REPORT' and ${binEvents.createdAt} >= ${todayStart})`.mapWith(Number),
        reports7: sql<number>`count(*) filter (where ${binEvents.type} = 'MISSING_REPORT' and ${binEvents.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        removedToday: sql<number>`count(*) filter (where ${binEvents.type} = 'REMOVED' and ${binEvents.createdAt} >= ${todayStart})`.mapWith(Number),
        removed7: sql<number>`count(*) filter (where ${binEvents.type} = 'REMOVED' and ${binEvents.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        removedTotal: sql<number>`count(*) filter (where ${binEvents.type} = 'REMOVED')`.mapWith(Number),
        adminDeletedTotal: sql<number>`count(*) filter (where ${binEvents.type} = 'ADMIN_DELETE')`.mapWith(Number),
      })
      .from(binEvents),

    db
      .select({
        total: count(),
        new7: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')`.mapWith(Number),
      })
      .from(users),
  ]);

  const b = binTotals[0]!;
  const e = eventTotals[0]!;
  const u = userTotals[0]!;

  return {
    bins: { active: b.active, byType: { WET: b.wet, DRY: b.dry, BOTH: b.both }, atRisk: b.atRisk },
    new: { today: e.newToday, last7Days: e.new7, last30Days: e.new30 },
    reports: { today: e.reportsToday, last7Days: e.reports7 },
    removed: { today: e.removedToday, last7Days: e.removed7, total: e.removedTotal, byAdmin: e.adminDeletedTotal },
    users: { total: u.total, newLast7Days: u.new7 },
  };
}

export async function getTimeseries(days: number) {
  const db = getDb();

  const rows = await db.execute<{ day: string; registrations: number; missing_reports: number; removals: number }>(sql`
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      count(e.id) filter (where e.type = 'REGISTERED')::int as registrations,
      count(e.id) filter (where e.type = 'MISSING_REPORT')::int as missing_reports,
      count(e.id) filter (where e.type = 'REMOVED')::int as removals
    from generate_series(
      (now() at time zone ${TZ})::date - ${days - 1}::int,
      (now() at time zone ${TZ})::date,
      interval '1 day'
    ) as d(day)
    left join ${binEvents} e
      on (e.created_at at time zone ${TZ})::date = d.day::date
    group by d.day
    order by d.day
  `);

  return {
    days,
    timezone: TZ,
    series: rows.map((r) => ({
      day: r.day,
      registrations: Number(r.registrations),
      missingReports: Number(r.missing_reports),
      removals: Number(r.removals),
    })),
  };
}

const binListColumns = {
  ...getTableColumns(bins),
  creatorEmail: users.email,
};

async function withImageUrl<T extends { imageKey: string }>(bin: T) {
  const { imageKey, ...rest } = bin;
  return { ...rest, imageUrl: await getImageViewUrl(imageKey) };
}

export async function listBins(query: BinsListQuery) {
  const db = getDb();

  const where = and(
    query.type ? eq(bins.type, query.type) : undefined,
    query.reported === true ? gt(bins.missingReports, 0) : undefined,
    query.reported === false ? eq(bins.missingReports, 0) : undefined,
    query.q ? ilike(bins.name, `%${query.q}%`) : undefined
  );

  const orderBy =
    query.sort === "oldest"
      ? [asc(bins.createdAt)]
      : query.sort === "mostReported"
        ? [desc(bins.missingReports), desc(bins.createdAt)]
        : [desc(bins.createdAt)];

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(binListColumns)
      .from(bins)
      .leftJoin(users, eq(bins.createdBy, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(bins).where(where),
  ]);

  const items = await Promise.all(rows.map(withImageUrl));
  return paged(items, query.page, query.pageSize, totalRow!.total);
}

export async function getBinsForMap() {
  const db = getDb();
  return db
    .select({
      id: bins.id,
      name: bins.name,
      type: bins.type,
      latitude: bins.latitude,
      longitude: bins.longitude,
      missingReports: bins.missingReports,
    })
    .from(bins);
}

export async function getBinDetails(binId: string) {
  const db = getDb();

  const [bin] = await db
    .select(binListColumns)
    .from(bins)
    .leftJoin(users, eq(bins.createdBy, users.id))
    .where(eq(bins.id, binId))
    .limit(1);

  if (!bin) {
    throw ApiError.notFound("Dustbin not found");
  }

  const timeline = await db
    .select({ ...getTableColumns(binEvents), userEmail: users.email })
    .from(binEvents)
    .leftJoin(users, eq(binEvents.userId, users.id))
    .where(eq(binEvents.binId, binId))
    .orderBy(desc(binEvents.createdAt))
    .limit(100);

  return { ...(await withImageUrl(bin)), timeline };
}

export async function updateBin(adminId: string, binId: string, body: BinPatchBody) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(bins).where(eq(bins.id, binId)).for("update");
    if (!before) {
      throw ApiError.notFound("Dustbin not found");
    }

    const changes: Partial<typeof bins.$inferInsert> = {};
    if (body.name !== undefined) changes.name = body.name;
    if (body.type !== undefined) changes.type = body.type;
    if (body.resetReports) changes.missingReports = 0;

    const [updated] = await tx.update(bins).set(changes).where(eq(bins.id, binId)).returning();

    if (body.name !== undefined || body.type !== undefined) {
      await logBinEvent(tx, {
        binId,
        userId: adminId,
        type: "ADMIN_EDIT",
        meta: {
          before: { name: before.name, type: before.type },
          after: { name: updated!.name, type: updated!.type },
        },
      });
    }
    if (body.resetReports) {
      await logBinEvent(tx, {
        binId,
        userId: adminId,
        type: "ADMIN_RESET_REPORTS",
        meta: { previousMissingReports: before.missingReports },
      });
    }

    return withImageUrl(updated!);
  });
}

export async function deleteBin(adminId: string, binId: string) {
  const db = getDb();

  const removed = await db.transaction(async (tx) => {
    const [bin] = await tx.delete(bins).where(eq(bins.id, binId)).returning();
    if (!bin) {
      throw ApiError.notFound("Dustbin not found");
    }

    await logBinEvent(tx, {
      binId,
      userId: adminId,
      type: "ADMIN_DELETE",
      latitude: bin.latitude,
      longitude: bin.longitude,
      meta: {
        name: bin.name,
        type: bin.type,
        createdBy: bin.createdBy,
        registeredAt: bin.createdAt,
        missingReports: bin.missingReports,
      },
    });

    return bin;
  });

  await deleteImageObject(removed.imageKey);
  return { id: removed.id, deleted: true };
}

export async function listEvents(query: EventsQuery) {
  const db = getDb();

  const where = and(
    query.type ? eq(binEvents.type, query.type) : undefined,
    query.binId ? eq(binEvents.binId, query.binId) : undefined
  );

  const [items, [totalRow]] = await Promise.all([
    db
      .select({ ...getTableColumns(binEvents), userEmail: users.email })
      .from(binEvents)
      .leftJoin(users, eq(binEvents.userId, users.id))
      .where(where)
      .orderBy(desc(binEvents.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(binEvents).where(where),
  ]);

  return paged(items, query.page, query.pageSize, totalRow!.total);
}

export async function listUsers(page: number, pageSize: number) {
  const db = getDb();

  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        points: users.points,
        createdAt: users.createdAt,
        // Drizzle drops table prefixes in single-table selects, so these
        // correlated subqueries use explicit aliases to reach the outer users row
        registrations: sql<number>`(select count(*) from bin_events e where e.user_id = "users"."id" and e.type = 'REGISTERED')`.mapWith(Number),
        missingReports: sql<number>`(select count(*) from bin_events e where e.user_id = "users"."id" and e.type = 'MISSING_REPORT')`.mapWith(Number),
        activeBins: sql<number>`(select count(*) from bins b where b.created_by = "users"."id")`.mapWith(Number),
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(users),
  ]);

  return paged(items, page, pageSize, totalRow!.total);
}
